import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AnimalGender,
  AnimalImportJobDto,
  AnimalLineageDto,
  AnimalQueryFilterDto,
  AnimalResponseDto,
  AnimalSpecies,
  AnimalStatus,
  AnimalWeightLogDto,
  CheckTagAvailabilityDto,
  GrowthCurveAnalyticsDto,
  GrowthCurvePointDto,
  GrowthTrajectory,
  InbreedingRiskLevel,
  OffspringSummaryDto,
  PaginatedAnimalsDto,
  PaginatedImportJobsDto,
  PaginatedWeightLogsDto,
  PedigreeNodeDto,
  RecordWeightDto,
  RegisterAnimalRequestDto,
  TagAvailabilityResponseDto,
  UpdateAnimalRequestDto,
  WeightHistoryQueryDto,
} from "@vetralink/shared-types";
import {
  ANIMAL_REPOSITORY,
  AncestorRecordRaw,
  IAnimalRepository,
  OffspringRecordRaw,
} from "../repositories/animal.repository.interface";
import {
  ANIMAL_WEIGHT_REPOSITORY,
  IAnimalWeightRepository,
} from "../repositories/animal-weight.repository.interface";
import {
  ANIMAL_IMPORT_JOB_REPOSITORY,
  IAnimalImportJobRepository,
} from "../repositories/animal-import-job.repository.interface";
import {
  ANIMAL_IMPORT_QUEUE_SERVICE,
  IAnimalImportQueueService,
} from "./animal-import-queue.service.interface";
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
import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAnimalsService } from "./animals.service.interface";

@Injectable()
export class AnimalsService implements IAnimalsService {
  private readonly logger = new Logger(AnimalsService.name);

  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(ANIMAL_WEIGHT_REPOSITORY)
    private readonly animalWeightRepository: IAnimalWeightRepository,
    @Inject(ANIMAL_IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: IAnimalImportJobRepository,
    @Inject(ANIMAL_IMPORT_QUEUE_SERVICE)
    private readonly importQueueService: IAnimalImportQueueService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async registerAnimal(
    farmId: string,
    dto: RegisterAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const normalizedTag = dto.tagNumber.trim().toUpperCase();

    // 1. Tag Uniqueness Invariant within Tenant Herd
    const tagExists = await this.animalRepository.existsActiveTag(
      normalizedTag,
      farmId
    );
    if (tagExists) {
      throw new EntityConflictException(
        `An active animal with tag number '${normalizedTag}' already exists in this farm herd.`,
        "tagNumber"
      );
    }

    // 2. RFID Uniqueness Invariant within Tenant Herd (if provided)
    let normalizedRfid: string | null = null;
    if (dto.rfidNumber && dto.rfidNumber.trim().length > 0) {
      normalizedRfid = dto.rfidNumber.trim().toUpperCase();
      const rfidExists = await this.animalRepository.existsActiveRfid(
        normalizedRfid,
        farmId
      );
      if (rfidExists) {
        throw new EntityConflictException(
          `An active animal with RFID number '${normalizedRfid}' already exists in this farm herd.`,
          "rfidNumber"
        );
      }
    }

    // 3. Pedigree Validation (Sire)
    if (dto.sireId) {
      const sire = await this.animalRepository.findById(dto.sireId, farmId);
      if (!sire) {
        throw new EntityNotFoundException("Sire animal", dto.sireId);
      }
      if (sire.gender !== AnimalGender.MALE) {
        throw new ValidationDomainException(
          `Designated sire with tag '${sire.tagNumber}' must be biologically MALE.`
        );
      }
      if (sire.species !== dto.species) {
        throw new ValidationDomainException(
          `Designated sire species ('${sire.species}') must match offspring species ('${dto.species}').`
        );
      }
    }

    // 4. Pedigree Validation (Dam)
    if (dto.damId) {
      const dam = await this.animalRepository.findById(dto.damId, farmId);
      if (!dam) {
        throw new EntityNotFoundException("Dam animal", dto.damId);
      }
      if (dam.gender !== AnimalGender.FEMALE) {
        throw new ValidationDomainException(
          `Designated dam with tag '${dam.tagNumber}' must be biologically FEMALE.`
        );
      }
      if (dam.species !== dto.species) {
        throw new ValidationDomainException(
          `Designated dam species ('${dam.species}') must match offspring species ('${dto.species}').`
        );
      }
    }

    // 5. Date of Birth Parsing & Reality Check
    let dobDate: Date | null = null;
    if (dto.dateOfBirth) {
      dobDate = new Date(dto.dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        throw new ValidationDomainException(
          "Invalid date format for dateOfBirth. Expected ISO 8601 (YYYY-MM-DD)."
        );
      }
      if (dobDate.getTime() > Date.now()) {
        throw new ValidationDomainException(
          "Animal date of birth cannot be in the future."
        );
      }
    }

    // 6. Instantiate Domain Entity
    const animal = AnimalEntity.create({
      farmId,
      tagNumber: normalizedTag,
      rfidNumber: normalizedRfid,
      name: dto.name,
      species: dto.species,
      breed: dto.breed,
      gender: dto.gender,
      dateOfBirth: dobDate,
      weightKg: dto.weightKg,
      status: dto.status,
      sireId: dto.sireId,
      damId: dto.damId,
      metadata: dto.metadata,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    // 7. Persist & Audit in an Atomic Transaction
    let savedAnimal!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      savedAnimal = await this.animalRepository.create(animal, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_REGISTERED",
          entityType: "Animal",
          entityId: savedAnimal.id,
          newValues: savedAnimal.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Registered animal '${savedAnimal.tagNumber}' [${savedAnimal.id}] for farm [${farmId}]`
    );

    return savedAnimal.toResponse();
  }

  public async updateAnimal(
    id: string,
    farmId: string,
    dto: UpdateAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const existing = await this.animalRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("Animal", id);
    }

    // 1. Tag Uniqueness Check if Updating Tag Number
    if (dto.tagNumber) {
      const normalizedTag = dto.tagNumber.trim().toUpperCase();
      if (normalizedTag !== existing.tagNumber) {
        const tagExists = await this.animalRepository.existsActiveTag(
          normalizedTag,
          farmId,
          id
        );
        if (tagExists) {
          throw new EntityConflictException(
            `An active animal with tag number '${normalizedTag}' already exists in this farm herd.`,
            "tagNumber"
          );
        }
      }
    }

    // 2. RFID Uniqueness Check if Updating RFID Number
    let normalizedRfid: string | null | undefined = undefined;
    if (dto.rfidNumber !== undefined) {
      if (dto.rfidNumber !== null && dto.rfidNumber.trim().length > 0) {
        normalizedRfid = dto.rfidNumber.trim().toUpperCase();
        if (normalizedRfid !== existing.rfidNumber) {
          const rfidExists = await this.animalRepository.existsActiveRfid(
            normalizedRfid,
            farmId,
            id
          );
          if (rfidExists) {
            throw new EntityConflictException(
              `An active animal with RFID number '${normalizedRfid}' already exists in this farm herd.`,
              "rfidNumber"
            );
          }
        }
      } else {
        normalizedRfid = null;
      }
    }

    const targetSpecies = dto.species ?? existing.species;

    // 3. Pedigree Validation (Sire)
    if (dto.sireId !== undefined) {
      if (dto.sireId !== null) {
        if (dto.sireId === id) {
          throw new ValidationDomainException(
            "An animal cannot be designated as its own sire."
          );
        }
        const sire = await this.animalRepository.findById(dto.sireId, farmId);
        if (!sire) {
          throw new EntityNotFoundException("Sire animal", dto.sireId);
        }
        if (sire.gender !== AnimalGender.MALE) {
          throw new ValidationDomainException(
            `Designated sire with tag '${sire.tagNumber}' must be biologically MALE.`
          );
        }
        if (sire.species !== targetSpecies) {
          throw new ValidationDomainException(
            `Designated sire species ('${sire.species}') must match offspring species ('${targetSpecies}').`
          );
        }
      }
    }

    // 4. Pedigree Validation (Dam)
    if (dto.damId !== undefined) {
      if (dto.damId !== null) {
        if (dto.damId === id) {
          throw new ValidationDomainException(
            "An animal cannot be designated as its own dam."
          );
        }
        const dam = await this.animalRepository.findById(dto.damId, farmId);
        if (!dam) {
          throw new EntityNotFoundException("Dam animal", dto.damId);
        }
        if (dam.gender !== AnimalGender.FEMALE) {
          throw new ValidationDomainException(
            `Designated dam with tag '${dam.tagNumber}' must be biologically FEMALE.`
          );
        }
        if (dam.species !== targetSpecies) {
          throw new ValidationDomainException(
            `Designated dam species ('${dam.species}') must match offspring species ('${targetSpecies}').`
          );
        }
      }
    }

    // 5. Date of Birth Parsing
    let dobDate: Date | null | undefined = undefined;
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth === null) {
        dobDate = null;
      } else {
        dobDate = new Date(dto.dateOfBirth);
        if (isNaN(dobDate.getTime())) {
          throw new ValidationDomainException(
            "Invalid date format for dateOfBirth. Expected ISO 8601 (YYYY-MM-DD)."
          );
        }
        if (dobDate.getTime() > Date.now()) {
          throw new ValidationDomainException(
            "Animal date of birth cannot be in the future."
          );
        }
      }
    }

    const oldValues = existing.toResponse();

    existing.updateDetails({
      tagNumber: dto.tagNumber,
      rfidNumber: normalizedRfid,
      name: dto.name,
      species: dto.species,
      breed: dto.breed,
      gender: dto.gender,
      dateOfBirth: dobDate,
      weightKg: dto.weightKg,
      status: dto.status,
      sireId: dto.sireId,
      damId: dto.damId,
      metadata: dto.metadata,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    let updatedAnimal!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      updatedAnimal = await this.animalRepository.update(existing, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_UPDATED",
          entityType: "Animal",
          entityId: updatedAnimal.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: updatedAnimal.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Updated animal '${updatedAnimal.tagNumber}' [${updatedAnimal.id}] for farm [${farmId}]`
    );

    return updatedAnimal.toResponse();
  }

  public async getAnimalById(
    id: string,
    farmId: string
  ): Promise<AnimalResponseDto> {
    const animal = await this.animalRepository.findById(id, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", id);
    }
    return animal.toResponse();
  }

  public async lookupByIdentifier(
    identifier: string,
    farmId: string
  ): Promise<AnimalResponseDto> {
    if (!identifier || identifier.trim().length === 0) {
      throw new ValidationDomainException("Scan identifier cannot be empty.");
    }
    const animal = await this.animalRepository.findByIdentifier(
      identifier,
      farmId
    );
    if (!animal) {
      throw new EntityNotFoundException(
        "Animal with tag/RFID identifier",
        identifier
      );
    }
    return animal.toResponse();
  }

  public async checkTagAvailability(
    farmId: string,
    dto: CheckTagAvailabilityDto
  ): Promise<TagAvailabilityResponseDto> {
    let tagResult = undefined;
    let rfidResult = undefined;

    if (dto.tagNumber && dto.tagNumber.trim().length > 0) {
      const normalizedTag = dto.tagNumber.trim().toUpperCase();
      const existingAnimal = await this.animalRepository.findByTagNumber(
        normalizedTag,
        farmId
      );
      const isConflict =
        Boolean(existingAnimal) &&
        (!dto.excludeAnimalId || existingAnimal!.id !== dto.excludeAnimalId);

      tagResult = {
        value: normalizedTag,
        isAvailable: !isConflict,
        conflictingAnimalId: isConflict && existingAnimal ? existingAnimal.id : undefined,
      };
    }

    if (dto.rfidNumber && dto.rfidNumber.trim().length > 0) {
      const normalizedRfid = dto.rfidNumber.trim().toUpperCase();
      const existingAnimal = await this.animalRepository.findByRfidNumber(
        normalizedRfid,
        farmId
      );
      const isConflict =
        Boolean(existingAnimal) &&
        (!dto.excludeAnimalId || existingAnimal!.id !== dto.excludeAnimalId);

      rfidResult = {
        value: normalizedRfid,
        isAvailable: !isConflict,
        conflictingAnimalId: isConflict && existingAnimal ? existingAnimal.id : undefined,
      };
    }

    return {
      ...(tagResult !== undefined && { tagNumber: tagResult }),
      ...(rfidResult !== undefined && { rfidNumber: rfidResult }),
    };
  }

  public async getAnimals(
    farmId: string,
    query: AnimalQueryFilterDto
  ): Promise<PaginatedAnimalsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const { items, total } = await this.animalRepository.findMany(farmId, query);

    return {
      items: items.map((animal) => animal.toResponse()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async archiveAnimal(
    id: string,
    farmId: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto> {
    const existing = await this.animalRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("Animal", id);
    }

    const activeTraceId = traceId ?? crypto.randomUUID();
    const oldValues = existing.toResponse();

    let archived!: AnimalEntity;
    await this.transactionManager.run(async (tx) => {
      archived = await this.animalRepository.softDelete(
        id,
        farmId,
        new Date(),
        tx
      );
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_ARCHIVED",
          entityType: "Animal",
          entityId: archived.id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: archived.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Archived animal '${archived.tagNumber}' [${archived.id}] for farm [${farmId}]`
    );

    return archived.toResponse();
  }

  public async getAnimalLineage(
    id: string,
    farmId: string,
    generations?: number
  ): Promise<AnimalLineageDto> {
    const animal = await this.animalRepository.findById(id, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", id);
    }

    const boundedGenerations = Math.min(5, Math.max(1, generations ?? 3));

    const [ancestorRows, offspringRows] = await Promise.all([
      this.animalRepository.findAncestors(id, farmId, boundedGenerations),
      this.animalRepository.findDirectOffspring(id, farmId),
    ]);

    // Group ancestors by ID
    const ancestorsById = new Map<string, AncestorRecordRaw[]>();
    for (const row of ancestorRows) {
      const list = ancestorsById.get(row.id) ?? [];
      list.push(row);
      ancestorsById.set(row.id, list);
    }

    // Build hierarchical tree
    const rootNode: PedigreeNodeDto = {
      id: animal.id,
      tagNumber: animal.tagNumber,
      rfidNumber: animal.rfidNumber,
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      gender: animal.gender,
      dateOfBirth: animal.dateOfBirth
        ? animal.dateOfBirth.toISOString().split("T")[0]
        : null,
      status: animal.status,
      generation: 0,
      sire: animal.sireId
        ? this.buildPedigreeSubtree(
            animal.sireId,
            1,
            boundedGenerations,
            ancestorsById,
            new Set([animal.id])
          )
        : null,
      dam: animal.damId
        ? this.buildPedigreeSubtree(
            animal.damId,
            1,
            boundedGenerations,
            ancestorsById,
            new Set([animal.id])
          )
        : null,
    };

    // Calculate Inbreeding Coefficient
    const inbreedingCoefficient = this.calculateInbreedingCoefficient(
      animal.sireId,
      animal.damId,
      ancestorRows
    );
    const inbreedingRisk = this.classifyInbreedingRisk(inbreedingCoefficient);

    // Map direct offspring
    const directOffspring: OffspringSummaryDto[] = offspringRows.map((o) => ({
      id: o.id,
      tagNumber: o.tag_number,
      rfidNumber: o.rfid_number,
      name: o.name,
      species: o.species as AnimalSpecies,
      breed: o.breed,
      gender: o.gender as AnimalGender,
      dateOfBirth: o.date_of_birth
        ? typeof o.date_of_birth === "string"
          ? o.date_of_birth.split("T")[0]
          : o.date_of_birth.toISOString().split("T")[0]
        : null,
      status: o.status as AnimalStatus,
      otherParentId: o.other_parent_id,
      otherParentTagNumber: o.other_parent_tag_number,
      otherParentName: o.other_parent_name,
    }));

    const uniqueAncestorIds = new Set(ancestorRows.map((r) => r.id));
    const maxGenFound = ancestorRows.reduce(
      (max, r) => Math.max(max, r.generation),
      0
    );

    return {
      rootAnimal: rootNode,
      maxGenerations: boundedGenerations,
      ancestorGenerationsFound: maxGenFound,
      totalAncestors: uniqueAncestorIds.size,
      inbreedingCoefficient,
      inbreedingRisk,
      directOffspring,
      totalOffspring: directOffspring.length,
    };
  }

  private buildPedigreeSubtree(
    animalId: string | null,
    currentGen: number,
    maxGen: number,
    ancestorsById: Map<string, AncestorRecordRaw[]>,
    visited: Set<string>
  ): PedigreeNodeDto | null {
    if (!animalId || currentGen > maxGen || visited.has(animalId)) {
      return null;
    }

    const matches = ancestorsById.get(animalId);
    if (!matches || matches.length === 0) {
      return null;
    }

    const record =
      matches.find((r) => r.generation === currentGen) ?? matches[0];

    const nextVisited = new Set(visited);
    nextVisited.add(animalId);

    const sireNode = record.sire_id
      ? this.buildPedigreeSubtree(
          record.sire_id,
          currentGen + 1,
          maxGen,
          ancestorsById,
          nextVisited
        )
      : null;

    const damNode = record.dam_id
      ? this.buildPedigreeSubtree(
          record.dam_id,
          currentGen + 1,
          maxGen,
          ancestorsById,
          nextVisited
        )
      : null;

    return {
      id: record.id,
      tagNumber: record.tag_number,
      rfidNumber: record.rfid_number,
      name: record.name,
      species: record.species as AnimalSpecies,
      breed: record.breed,
      gender: record.gender as AnimalGender,
      dateOfBirth: record.date_of_birth
        ? typeof record.date_of_birth === "string"
          ? record.date_of_birth.split("T")[0]
          : record.date_of_birth.toISOString().split("T")[0]
        : null,
      status: record.status as AnimalStatus,
      generation: currentGen,
      sire: sireNode,
      dam: damNode,
    };
  }

  private calculateInbreedingCoefficient(
    sireId: string | null,
    damId: string | null,
    ancestorRows: AncestorRecordRaw[]
  ): number {
    if (!sireId || !damId) {
      return 0;
    }

    const sireAncestors = new Map<string, number>();
    sireAncestors.set(sireId, 0);

    const damAncestors = new Map<string, number>();
    damAncestors.set(damId, 0);

    for (const row of ancestorRows) {
      if (row.branch === "SIRE") {
        const dist = row.generation - 1;
        const prev = sireAncestors.get(row.id);
        if (prev === undefined || dist < prev) {
          sireAncestors.set(row.id, dist);
        }
      } else if (row.branch === "DAM") {
        const dist = row.generation - 1;
        const prev = damAncestors.get(row.id);
        if (prev === undefined || dist < prev) {
          damAncestors.set(row.id, dist);
        }
      }
    }

    let coeff = 0;
    for (const [ancestorId, n1] of sireAncestors.entries()) {
      if (damAncestors.has(ancestorId)) {
        const n2 = damAncestors.get(ancestorId)!;
        coeff += Math.pow(0.5, n1 + n2 + 1);
      }
    }

    return Math.round(coeff * 10000) / 10000;
  }

  private classifyInbreedingRisk(coeff: number): InbreedingRiskLevel {
    if (coeff >= 0.125) return InbreedingRiskLevel.CRITICAL;
    if (coeff >= 0.0625) return InbreedingRiskLevel.HIGH;
    if (coeff >= 0.01) return InbreedingRiskLevel.MODERATE;
    return InbreedingRiskLevel.LOW;
  }

  public async recordWeight(
    animalId: string,
    farmId: string,
    dto: RecordWeightDto,
    actorUserId: string,
    traceId?: string
  ): Promise<AnimalWeightLogDto> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    const recordedDate = new Date(dto.recordedAt);
    if (isNaN(recordedDate.getTime())) {
      throw new ValidationDomainException(
        "Invalid recordedAt timestamp. Expected ISO 8601 format."
      );
    }
    if (recordedDate.getTime() > Date.now() + 60000) {
      throw new ValidationDomainException(
        "Weight measurement cannot be recorded in the future."
      );
    }

    const logEntity = AnimalWeightLogEntity.create({
      farmId,
      animalId,
      recordedById: actorUserId,
      weightKg: dto.weightKg,
      recordedAt: recordedDate,
      notes: dto.notes,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    let createdLog!: AnimalWeightLogEntity;
    await this.transactionManager.run(async (tx) => {
      createdLog = await this.animalWeightRepository.create(logEntity, tx);

      const latest = await this.animalWeightRepository.findLatestByAnimalId(
        animalId,
        farmId,
        tx
      );
      if (latest && latest.id === createdLog.id) {
        animal.updateDetails({ weightKg: createdLog.weightKg });
        await this.animalRepository.update(animal, tx);
      }

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_WEIGHT_RECORDED",
          entityType: "AnimalWeightLog",
          entityId: createdLog.id,
          newValues: createdLog.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Recorded weight ${createdLog.weightKg}kg for animal '${animal.tagNumber}' [${animal.id}]`
    );

    return createdLog.toResponse(animal.dateOfBirth);
  }

  public async getWeightHistory(
    animalId: string,
    farmId: string,
    query?: WeightHistoryQueryDto
  ): Promise<PaginatedWeightLogsDto> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));

    const startDate = query?.startDate ? new Date(query.startDate) : undefined;
    const endDate = query?.endDate ? new Date(query.endDate) : undefined;

    const { items, total } = await this.animalWeightRepository.findByAnimalId(
      animalId,
      farmId,
      { startDate, endDate, page, limit }
    );

    return {
      items: items.map((log) => log.toResponse(animal.dateOfBirth)),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getGrowthCurve(
    animalId: string,
    farmId: string
  ): Promise<GrowthCurveAnalyticsDto> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    const logs = await this.animalWeightRepository.findAllChronological(
      animalId,
      farmId
    );

    const birthDateStr = animal.dateOfBirth
      ? animal.dateOfBirth.toISOString().split("T")[0]
      : null;
    const currentAgeDays = animal.dateOfBirth
      ? Math.floor((Date.now() - animal.dateOfBirth.getTime()) / 86400000)
      : null;

    if (logs.length === 0) {
      return {
        animalId: animal.id,
        tagNumber: animal.tagNumber,
        species: animal.species,
        birthDate: birthDateStr,
        currentAgeDays,
        currentWeightKg: animal.weightKg,
        startingWeightKg: null,
        totalGainKg: null,
        overallAdgKg: null,
        trajectory: GrowthTrajectory.STEADY,
        hasWeightLossAlert: false,
        points: [],
      };
    }

    const points: GrowthCurvePointDto[] = [];
    points.push({
      logId: logs[0].id,
      recordedAt: logs[0].recordedAt.toISOString(),
      weightKg: logs[0].weightKg,
      ageDays: logs[0].calculateAgeDays(animal.dateOfBirth),
      intervalDays: 0,
      weightChangeKg: 0,
      intervalAdgKg: 0,
    });

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const diffMs = curr.recordedAt.getTime() - prev.recordedAt.getTime();
      const intervalDays = Math.max(0, Math.round(diffMs / 86400000));
      const weightChangeKg =
        Math.round((curr.weightKg - prev.weightKg) * 100) / 100;
      const intervalAdgKg =
        intervalDays > 0
          ? Math.round((weightChangeKg / intervalDays) * 1000) / 1000
          : 0;

      points.push({
        logId: curr.id,
        recordedAt: curr.recordedAt.toISOString(),
        weightKg: curr.weightKg,
        ageDays: curr.calculateAgeDays(animal.dateOfBirth),
        intervalDays,
        weightChangeKg,
        intervalAdgKg,
      });
    }

    const first = logs[0];
    const last = logs[logs.length - 1];
    const startingWeightKg = first.weightKg;
    const currentWeightKg = last.weightKg;
    const totalGainKg =
      Math.round((currentWeightKg - startingWeightKg) * 100) / 100;

    const totalDaysDiffMs =
      last.recordedAt.getTime() - first.recordedAt.getTime();
    const totalDays = Math.round(totalDaysDiffMs / 86400000);
    const overallAdgKg =
      totalDays > 0
        ? Math.round((totalGainKg / totalDays) * 1000) / 1000
        : 0;

    const hasWeightLossAlert = points.some((p) => p.weightChangeKg < 0);

    let trajectory: GrowthTrajectory = GrowthTrajectory.STEADY;
    if (points.length > 1) {
      const latestAdg = points[points.length - 1].intervalAdgKg;
      if (latestAdg < 0) {
        trajectory = GrowthTrajectory.WEIGHT_LOSS;
      } else if (overallAdgKg !== null && overallAdgKg > 0) {
        if (latestAdg > overallAdgKg * 1.1) {
          trajectory = GrowthTrajectory.ACCELERATING;
        } else if (latestAdg < overallAdgKg * 0.9) {
          trajectory = GrowthTrajectory.SLOWING;
        } else {
          trajectory = GrowthTrajectory.STEADY;
        }
      }
    }

    return {
      animalId: animal.id,
      tagNumber: animal.tagNumber,
      species: animal.species,
      birthDate: birthDateStr,
      currentAgeDays,
      currentWeightKg,
      startingWeightKg,
      totalGainKg,
      overallAdgKg,
      trajectory,
      hasWeightLossAlert,
      points,
    };
  }

  public async deleteWeightLog(
    animalId: string,
    weightLogId: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", animalId);
    }

    const weightLog = await this.animalWeightRepository.findById(
      weightLogId,
      farmId
    );
    if (!weightLog || weightLog.animalId !== animalId) {
      throw new EntityNotFoundException("AnimalWeightLog", weightLogId);
    }

    const activeTraceId = traceId ?? crypto.randomUUID();

    await this.transactionManager.run(async (tx) => {
      await this.animalWeightRepository.delete(weightLogId, farmId, tx);

      const remainingLatest =
        await this.animalWeightRepository.findLatestByAnimalId(
          animalId,
          farmId,
          tx
        );
      animal.updateDetails({
        weightKg: remainingLatest ? remainingLatest.weightKg : null,
      });
      await this.animalRepository.update(animal, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "ANIMAL_WEIGHT_DELETED",
          entityType: "AnimalWeightLog",
          entityId: weightLogId,
          oldValues: weightLog.toResponse() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Deleted weight log [${weightLogId}] for animal '${animal.tagNumber}' [${animal.id}]`
    );
  }

  public async createImportJob(
    farmId: string,
    file: Express.Multer.File,
    actorUserId: string,
    traceId?: string
  ): Promise<AnimalImportJobDto> {
    if (!file) {
      throw new ValidationDomainException("No file was uploaded.");
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      throw new ValidationDomainException("File size exceeds 10MB limit.");
    }

    const originalName = file.originalname || "animals.csv";
    const ext = originalName.split(".").pop()?.toLowerCase() || "";
    const allowedExts = ["csv", "xlsx", "xls"];
    if (!allowedExts.includes(ext)) {
      throw new ValidationDomainException(
        `Unsupported file extension '.${ext}'. Allowed extensions: ${allowedExts.join(", ")}.`
      );
    }

    const tempDir = join(tmpdir(), "vetralink-imports");
    await fs.mkdir(tempDir, { recursive: true });
    const stagingPath = join(tempDir, `import-${crypto.randomUUID()}.${ext}`);
    await fs.writeFile(stagingPath, file.buffer);

    const jobEntity = AnimalImportJobEntity.create({
      farmId,
      uploadedById: actorUserId,
      fileName: originalName,
      fileSize: file.size,
      fileType: ext,
      filePath: stagingPath,
    });

    const createdJob = await this.importJobRepository.create(jobEntity);

    await this.importQueueService.enqueueImportJob({
      jobId: createdJob.id,
      farmId,
      filePath: stagingPath,
      actorUserId,
      traceId,
    });

    this.logger.log(
      `Created import job [${createdJob.id}] for farm [${farmId}] with file '${originalName}'`
    );

    return createdJob.toResponse();
  }

  public async getImportJob(
    jobId: string,
    farmId: string
  ): Promise<AnimalImportJobDto> {
    const job = await this.importJobRepository.findById(jobId, farmId);
    if (!job) {
      throw new EntityNotFoundException("AnimalImportJob", jobId);
    }
    return job.toResponse();
  }

  public async getImportJobs(
    farmId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedImportJobsDto> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));

    const { items, total } = await this.importJobRepository.findByFarmId(farmId, {
      page: validPage,
      limit: validLimit,
    });

    return {
      items: items.map((job) => job.toResponse()),
      meta: {
        page: validPage,
        pageSize: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit) || 1,
      },
    };
  }

  public generateImportTemplate(): string {
    return [
      "tagNumber,name,species,breed,gender,dateOfBirth,weightKg,rfidNumber,sireTag,damTag",
      "COW-001,Daisy,COW,Holstein,FEMALE,2023-01-15,450.5,982000000000001,BULL-001,COW-099",
      "BULL-002,Titan,COW,Angus,MALE,2022-06-10,780.0,982000000000002,,",
      "GOAT-010,Billy,GOAT,Boer,MALE,2023-08-01,45.2,,,",
    ].join("\r\n");
  }
}
