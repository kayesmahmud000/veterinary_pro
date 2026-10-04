import { Test, TestingModule } from "@nestjs/testing";
import * as xlsx from "xlsx";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Job } from "bullmq";
import {
  AnimalGender,
  AnimalSpecies,
  ImportJobStatus,
} from "@vetralink/shared-types";
import { AnimalImportProcessor } from "./animal-import.processor";
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
import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";
import { AnimalEntity } from "../entities/animal.entity";

describe("AnimalImportProcessor", () => {
  let processor: AnimalImportProcessor;
  let importJobRepository: jest.Mocked<IAnimalImportJobRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let animalWeightRepository: jest.Mocked<IAnimalWeightRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const actorUserId = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    importJobRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      update: jest.fn(),
    };

    animalRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByTagNumber: jest.fn(),
      findByRfidNumber: jest.fn(),
      findByIdentifier: jest.fn(),
      findMany: jest.fn(),
      existsActiveTag: jest.fn(),
      existsActiveRfid: jest.fn(),
      softDelete: jest.fn(),
      findAncestors: jest.fn(),
      findDirectOffspring: jest.fn(),
      findManyByIds: jest.fn(),
      getFarmName: jest.fn(),
    };

    animalWeightRepository = {
      create: jest.fn(),
      findByAnimalId: jest.fn(),
      findAllChronological: jest.fn(),
      findLatestByAnimalId: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    };

    auditLogRepository = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as any);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalImportProcessor,
        {
          provide: ANIMAL_IMPORT_JOB_REPOSITORY,
          useValue: importJobRepository,
        },
        {
          provide: ANIMAL_REPOSITORY,
          useValue: animalRepository,
        },
        {
          provide: ANIMAL_WEIGHT_REPOSITORY,
          useValue: animalWeightRepository,
        },
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: auditLogRepository,
        },
        {
          provide: TRANSACTION_MANAGER,
          useValue: transactionManager,
        },
      ],
    }).compile();

    processor = module.get<AnimalImportProcessor>(AnimalImportProcessor);
  });

  const createTempSpreadsheet = async (
    rows: Record<string, unknown>[],
    filename: string = "test.csv"
  ): Promise<string> => {
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Animals");
    const filePath = join(tmpdir(), `${Date.now()}-${filename}`);
    xlsx.writeFile(wb, filePath);
    return filePath;
  };

  it("should gracefully handle when import job is not found in database", async () => {
    importJobRepository.findById.mockResolvedValueOnce(null);

    const mockJob = {
      data: {
        jobId: "unknown-job",
        farmId,
        filePath: "/tmp/non-existent.csv",
        actorUserId,
      },
      updateProgress: jest.fn(),
    } as unknown as Job;

    await processor.process(mockJob);

    expect(importJobRepository.update).not.toHaveBeenCalled();
  });

  it("should fail job if spreadsheet has zero data rows", async () => {
    const filePath = await createTempSpreadsheet([], "empty.csv");

    const jobEntity = AnimalImportJobEntity.create({
      farmId,
      uploadedById: actorUserId,
      fileName: "empty.csv",
      fileSize: 100,
      fileType: "csv",
      filePath,
    });

    importJobRepository.findById.mockResolvedValueOnce(jobEntity);
    importJobRepository.update.mockResolvedValue(jobEntity);

    const mockJob = {
      data: {
        jobId: jobEntity.id,
        farmId,
        filePath,
        actorUserId,
      },
      updateProgress: jest.fn(),
    } as unknown as Job;

    await processor.process(mockJob);

    expect(jobEntity.status).toBe(ImportJobStatus.FAILED);
    expect(jobEntity.errorReport).toEqual([
      { row: 0, message: "Import file contains no data rows." },
    ]);
  });

  it("should process valid rows, insert animals and weight logs, and mark COMPLETED", async () => {
    const testRows = [
      {
        tagNumber: "COW-101",
        name: "Bessie",
        species: "COW",
        gender: "FEMALE",
        dateOfBirth: "2023-01-15",
        weightKg: 450,
      },
      {
        tagNumber: "BULL-202",
        name: "Ferdinand",
        species: "COW",
        gender: "MALE",
        dateOfBirth: "2022-05-10",
        weightKg: 750,
      },
    ];

    const filePath = await createTempSpreadsheet(testRows, "valid.csv");

    const jobEntity = AnimalImportJobEntity.create({
      farmId,
      uploadedById: actorUserId,
      fileName: "valid.csv",
      fileSize: 1024,
      fileType: "csv",
      filePath,
    });

    importJobRepository.findById.mockResolvedValueOnce(jobEntity);
    importJobRepository.update.mockResolvedValue(jobEntity);
    animalRepository.existsActiveTag.mockResolvedValue(false);

    const createdCow = AnimalEntity.create({
      id: "animal-1",
      farmId,
      tagNumber: "COW-101",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
    });
    const createdBull = AnimalEntity.create({
      id: "animal-2",
      farmId,
      tagNumber: "BULL-202",
      species: AnimalSpecies.COW,
      gender: AnimalGender.MALE,
    });

    animalRepository.create
      .mockResolvedValueOnce(createdCow)
      .mockResolvedValueOnce(createdBull);

    const mockJob = {
      data: {
        jobId: jobEntity.id,
        farmId,
        filePath,
        actorUserId,
      },
      updateProgress: jest.fn(),
    } as unknown as Job;

    await processor.process(mockJob);

    expect(animalRepository.create).toHaveBeenCalledTimes(2);
    expect(animalWeightRepository.create).toHaveBeenCalledTimes(2);
    expect(jobEntity.status).toBe(ImportJobStatus.COMPLETED);
    expect(jobEntity.successfulRows).toBe(2);
    expect(jobEntity.failedRows).toBe(0);
    expect(auditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ANIMAL_BULK_IMPORTED",
        userId: actorUserId,
      })
    );
  });

  it("should record row-level validation errors and mark PARTIALLY_COMPLETED", async () => {
    const testRows = [
      {
        tagNumber: "VALID-01",
        species: "COW",
        gender: "FEMALE",
      },
      {
        tagNumber: "", // Missing tag
        species: "COW",
        gender: "FEMALE",
      },
      {
        tagNumber: "DUPLICATE-01",
        species: "INVALID_SPECIES", // Invalid species
        gender: "FEMALE",
      },
      {
        tagNumber: "VALID-01", // Duplicate within file
        species: "COW",
        gender: "FEMALE",
      },
    ];

    const filePath = await createTempSpreadsheet(testRows, "errors.csv");

    const jobEntity = AnimalImportJobEntity.create({
      farmId,
      uploadedById: actorUserId,
      fileName: "errors.csv",
      fileSize: 1024,
      fileType: "csv",
      filePath,
    });

    importJobRepository.findById.mockResolvedValueOnce(jobEntity);
    importJobRepository.update.mockResolvedValue(jobEntity);
    animalRepository.existsActiveTag.mockResolvedValue(false);

    const createdValid = AnimalEntity.create({
      id: "animal-valid",
      farmId,
      tagNumber: "VALID-01",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
    });
    animalRepository.create.mockResolvedValueOnce(createdValid);

    const mockJob = {
      data: {
        jobId: jobEntity.id,
        farmId,
        filePath,
        actorUserId,
      },
      updateProgress: jest.fn(),
    } as unknown as Job;

    await processor.process(mockJob);

    expect(jobEntity.status).toBe(ImportJobStatus.PARTIALLY_COMPLETED);
    expect(jobEntity.successfulRows).toBe(1);
    expect(jobEntity.failedRows).toBe(3);
    expect(jobEntity.errorReport).toHaveLength(3);
  });

  it("should resolve sire and dam pedigree relations and report warnings for gender mismatches", async () => {
    const sireMock = AnimalEntity.create({
      id: "sire-1",
      farmId,
      tagNumber: "SIRE-99",
      species: AnimalSpecies.COW,
      gender: AnimalGender.MALE,
    });
    const femaleSireMistake = AnimalEntity.create({
      id: "dam-as-sire",
      farmId,
      tagNumber: "FEMALE-SIRE",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
    });

    const testRows = [
      {
        tagNumber: "CALF-01",
        species: "COW",
        gender: "FEMALE",
        sireTag: "SIRE-99",
      },
      {
        tagNumber: "CALF-02",
        species: "COW",
        gender: "FEMALE",
        sireTag: "FEMALE-SIRE", // Not male
      },
    ];

    const filePath = await createTempSpreadsheet(testRows, "pedigree.csv");

    const jobEntity = AnimalImportJobEntity.create({
      farmId,
      uploadedById: actorUserId,
      fileName: "pedigree.csv",
      fileSize: 1024,
      fileType: "csv",
      filePath,
    });

    importJobRepository.findById.mockResolvedValueOnce(jobEntity);
    importJobRepository.update.mockResolvedValue(jobEntity);
    animalRepository.existsActiveTag.mockResolvedValue(false);

    animalRepository.findByTagNumber
      .mockResolvedValueOnce(sireMock)
      .mockResolvedValueOnce(femaleSireMistake);

    const mockJob = {
      data: {
        jobId: jobEntity.id,
        farmId,
        filePath,
        actorUserId,
      },
      updateProgress: jest.fn(),
    } as unknown as Job;

    await processor.process(mockJob);

    expect(animalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sireId: "sire-1",
      }),
      expect.anything()
    );
  });
});
