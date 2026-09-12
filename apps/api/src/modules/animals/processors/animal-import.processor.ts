import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import * as xlsx from "xlsx";
import * as fs from "node:fs/promises";
import {
  AnimalGender,
  AnimalImportRowErrorDto,
  AnimalSpecies,
} from "@vetralink/shared-types";
import {
  ANIMAL_IMPORT_QUEUE,
  AnimalImportJobPayload,
} from "../services/animal-import-queue.service.interface";
import {
  ANIMAL_IMPORT_JOB_REPOSITORY,
  IAnimalImportJobRepository,
} from "../repositories/animal-import-job.repository.interface";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../repositories/animal.repository.interface";
import {
  ANIMAL_WEIGHT_REPOSITORY,
  IAnimalWeightRepository,
} from "../repositories/animal-weight.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { AnimalEntity } from "../entities/animal.entity";
import { AnimalWeightLogEntity } from "../entities/animal-weight-log.entity";

@Injectable()
@Processor(ANIMAL_IMPORT_QUEUE)
export class AnimalImportProcessor extends WorkerHost {
  private readonly logger = new Logger(AnimalImportProcessor.name);

  constructor(
    @Inject(ANIMAL_IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: IAnimalImportJobRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(ANIMAL_WEIGHT_REPOSITORY)
    private readonly animalWeightRepository: IAnimalWeightRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {
    super();
  }

  public async process(job: Job<AnimalImportJobPayload>): Promise<void> {
    const { jobId, farmId, filePath, actorUserId, traceId } = job.data;

    this.logger.log(
      `Processing bulk animal import job [${jobId}] for farm [${farmId}] from '${filePath}'`
    );

    const importJob = await this.importJobRepository.findById(jobId, farmId);
    if (!importJob) {
      this.logger.warn(`Import job [${jobId}] not found in database. Skipping.`);
      return;
    }

    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Spreadsheet contains no worksheets.");
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        importJob.fail("Import file contains no data rows.");
        importJob.clearFilePath();
        await this.importJobRepository.update(importJob);
        await fs.unlink(filePath).catch(() => {});
        return;
      }

      importJob.start(rawRows.length);
      await this.importJobRepository.update(importJob);

      let processedCount = 0;
      let successCount = 0;
      let failCount = 0;
      const accumulatedErrors: AnimalImportRowErrorDto[] = [];
      const seenTagsInFile = new Set<string>();
      const seenRfidsInFile = new Set<string>();

      for (let i = 0; i < rawRows.length; i++) {
        const rowNumber = i + 2; // Row 1 is header
        const rawRow = rawRows[i];
        const normalized = this.normalizeRow(rawRow);

        const rowErrors = await this.validateRow(
          normalized,
          rowNumber,
          farmId,
          seenTagsInFile,
          seenRfidsInFile
        );

        if (rowErrors.length > 0) {
          accumulatedErrors.push(...rowErrors);
          failCount++;
        } else {
          try {
            seenTagsInFile.add(normalized.tagNumber.toUpperCase());
            if (normalized.rfidNumber) {
              seenRfidsInFile.add(normalized.rfidNumber.toUpperCase());
            }

            let sireId: string | null = null;
            if (normalized.sireTag) {
              const sire = await this.animalRepository.findByTagNumber(
                normalized.sireTag.trim().toUpperCase(),
                farmId
              );
              if (sire && sire.gender === AnimalGender.MALE) {
                sireId = sire.id;
              } else if (sire && sire.gender !== AnimalGender.MALE) {
                accumulatedErrors.push({
                  row: rowNumber,
                  tagNumber: normalized.tagNumber,
                  field: "sireTag",
                  message: `Referenced sire '${normalized.sireTag}' is not male. Sire relation skipped.`,
                  rawData: rawRow,
                });
              }
            }

            let damId: string | null = null;
            if (normalized.damTag) {
              const dam = await this.animalRepository.findByTagNumber(
                normalized.damTag.trim().toUpperCase(),
                farmId
              );
              if (dam && dam.gender === AnimalGender.FEMALE) {
                damId = dam.id;
              } else if (dam && dam.gender !== AnimalGender.FEMALE) {
                accumulatedErrors.push({
                  row: rowNumber,
                  tagNumber: normalized.tagNumber,
                  field: "damTag",
                  message: `Referenced dam '${normalized.damTag}' is not female. Dam relation skipped.`,
                  rawData: rawRow,
                });
              }
            }

            const animalEntity = AnimalEntity.create({
              farmId,
              tagNumber: normalized.tagNumber,
              name: normalized.name || undefined,
              species: normalized.species!,
              breed: normalized.breed || undefined,
              gender: normalized.gender!,
              dateOfBirth: normalized.dateOfBirth,
              weightKg: normalized.weightKg,
              rfidNumber: normalized.rfidNumber || undefined,
              sireId: sireId || undefined,
              damId: damId || undefined,
            });

            await this.transactionManager.run(async (tx) => {
              const createdAnimal = await this.animalRepository.create(animalEntity, tx);

              if (normalized.weightKg !== undefined && normalized.weightKg !== null) {
                const weightLog = AnimalWeightLogEntity.create({
                  farmId,
                  animalId: createdAnimal.id,
                  recordedById: actorUserId,
                  weightKg: normalized.weightKg,
                  recordedAt: normalized.dateOfBirth ?? new Date(),
                  notes: "Initial weight from bulk import",
                });
                await this.animalWeightRepository.create(weightLog, tx);
              }
            });

            successCount++;
          } catch (rowException: any) {
            accumulatedErrors.push({
              row: rowNumber,
              tagNumber: normalized.tagNumber,
              message: `Database insertion error: ${rowException.message || "Unknown error"}`,
              rawData: rawRow,
            });
            failCount++;
          }
        }

        processedCount++;

        if (processedCount % 20 === 0 || processedCount === rawRows.length) {
          const progress = Math.round((processedCount / rawRows.length) * 100);
          await job.updateProgress(progress);
          importJob.recordProgress(
            processedCount,
            successCount,
            failCount,
            accumulatedErrors.splice(0, accumulatedErrors.length)
          );
          await this.importJobRepository.update(importJob);
        }
      }

      importJob.recordProgress(
        processedCount,
        successCount,
        failCount,
        accumulatedErrors
      );
      importJob.complete();
      importJob.clearFilePath();
      await this.importJobRepository.update(importJob);

      await this.auditLogRepository.record({
        userId: actorUserId,
        action: "ANIMAL_BULK_IMPORTED",
        entityType: "AnimalImportJob",
        entityId: importJob.id,
        newValues: {
          totalRows: importJob.totalRows,
          successfulRows: importJob.successfulRows,
          failedRows: importJob.failedRows,
          status: importJob.status,
        },
        traceId: traceId ?? crypto.randomUUID(),
      });

      this.logger.log(
        `Import job [${jobId}] finished with status '${importJob.status}'. Succeeded: ${importJob.successfulRows}, Failed: ${importJob.failedRows}`
      );
    } catch (err: any) {
      this.logger.error(`Import job [${jobId}] failed with critical error: ${err.message}`, err.stack);
      importJob.fail(`Processing error: ${err.message}`);
      importJob.clearFilePath();
      await this.importJobRepository.update(importJob);
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  }

  private normalizeRow(raw: Record<string, unknown>): {
    tagNumber: string;
    name?: string;
    species?: AnimalSpecies;
    breed?: string;
    gender?: AnimalGender;
    dateOfBirth?: Date;
    weightKg?: number;
    rfidNumber?: string;
    sireTag?: string;
    damTag?: string;
  } {
    const findValue = (keys: string[]): string => {
      for (const key of Object.keys(raw)) {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        for (const target of keys) {
          if (cleanKey === target) {
            return String(raw[key] ?? "").trim();
          }
        }
      }
      return "";
    };

    const tagNumber = findValue(["tagnumber", "tag", "eartag", "eartagnumber", "id"]);
    const name = findValue(["name", "animalname"]);
    const speciesRaw = findValue(["species", "animalspecies"]).toUpperCase();
    const breed = findValue(["breed"]);
    const genderRaw = findValue(["gender", "sex"]).toUpperCase();
    const dobRaw = findValue(["dateofbirth", "dob", "birthdate"]);
    const weightRaw = findValue(["weightkg", "weight", "currentweight"]);
    const rfidNumber = findValue(["rfidnumber", "rfid", "electronicid", "eid"]);
    const sireTag = findValue(["siretag", "sire", "siretagnumber"]);
    const damTag = findValue(["damtag", "dam", "damtagnumber"]);

    let species: AnimalSpecies | undefined;
    if (Object.values(AnimalSpecies).includes(speciesRaw as AnimalSpecies)) {
      species = speciesRaw as AnimalSpecies;
    }

    let gender: AnimalGender | undefined;
    if (genderRaw === "MALE" || genderRaw === "M") {
      gender = AnimalGender.MALE;
    } else if (genderRaw === "FEMALE" || genderRaw === "F") {
      gender = AnimalGender.FEMALE;
    }

    let dateOfBirth: Date | undefined;
    if (dobRaw) {
      const parsed = new Date(dobRaw);
      if (!isNaN(parsed.getTime())) {
        dateOfBirth = parsed;
      }
    }

    let weightKg: number | undefined;
    if (weightRaw) {
      const parsed = parseFloat(weightRaw);
      if (!isNaN(parsed)) {
        weightKg = Math.round(parsed * 100) / 100;
      }
    }

    return {
      tagNumber,
      name: name || undefined,
      species,
      breed: breed || undefined,
      gender,
      dateOfBirth,
      weightKg,
      rfidNumber: rfidNumber || undefined,
      sireTag: sireTag || undefined,
      damTag: damTag || undefined,
    };
  }

  private async validateRow(
    row: ReturnType<typeof this.normalizeRow>,
    rowNumber: number,
    farmId: string,
    seenTags: Set<string>,
    seenRfids: Set<string>
  ): Promise<AnimalImportRowErrorDto[]> {
    const errors: AnimalImportRowErrorDto[] = [];

    if (!row.tagNumber) {
      errors.push({
        row: rowNumber,
        field: "tagNumber",
        message: "Tag number is required.",
      });
    } else {
      const upperTag = row.tagNumber.toUpperCase();
      if (seenTags.has(upperTag)) {
        errors.push({
          row: rowNumber,
          tagNumber: row.tagNumber,
          field: "tagNumber",
          message: `Duplicate tagNumber '${row.tagNumber}' found within the same import file.`,
        });
      } else {
        const exists = await this.animalRepository.existsActiveTag(upperTag, farmId);
        if (exists) {
          errors.push({
            row: rowNumber,
            tagNumber: row.tagNumber,
            field: "tagNumber",
            message: `Tag number '${row.tagNumber}' is already in use by an active animal in this farm.`,
          });
        }
      }
    }

    if (!row.species) {
      errors.push({
        row: rowNumber,
        tagNumber: row.tagNumber,
        field: "species",
        message: `Species is required and must be one of: ${Object.values(AnimalSpecies).join(", ")}.`,
      });
    }

    if (!row.gender) {
      errors.push({
        row: rowNumber,
        tagNumber: row.tagNumber,
        field: "gender",
        message: "Gender is required and must be 'MALE' or 'FEMALE'.",
      });
    }

    if (row.rfidNumber) {
      const upperRfid = row.rfidNumber.toUpperCase();
      if (seenRfids.has(upperRfid)) {
        errors.push({
          row: rowNumber,
          tagNumber: row.tagNumber,
          field: "rfidNumber",
          message: `Duplicate rfidNumber '${row.rfidNumber}' found within the same import file.`,
        });
      } else {
        const exists = await this.animalRepository.existsActiveRfid(upperRfid, farmId);
        if (exists) {
          errors.push({
            row: rowNumber,
            tagNumber: row.tagNumber,
            field: "rfidNumber",
            message: `RFID number '${row.rfidNumber}' is already in use by an active animal in this farm.`,
          });
        }
      }
    }

    if (row.dateOfBirth && row.dateOfBirth.getTime() > Date.now() + 60000) {
      errors.push({
        row: rowNumber,
        tagNumber: row.tagNumber,
        field: "dateOfBirth",
        message: "Date of birth cannot be in the future.",
      });
    }

    if (row.weightKg !== undefined && (row.weightKg <= 0 || row.weightKg > 2500)) {
      errors.push({
        row: rowNumber,
        tagNumber: row.tagNumber,
        field: "weightKg",
        message: "Weight must be a positive number between 0.1 and 2500 kg.",
      });
    }

    return errors;
  }
}
