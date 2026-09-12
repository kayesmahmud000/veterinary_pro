import { Test, TestingModule } from "@nestjs/testing";
import { ImportJobStatus } from "@vetralink/shared-types";
import { AnimalImportJobRepository } from "./animal-import-job.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";

describe("AnimalImportJobRepository", () => {
  let repository: AnimalImportJobRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const actorUserId = "22222222-2222-2222-2222-222222222222";

  const mockDbRecord = {
    id: "job-1111-1111-1111-111111111111",
    farmId,
    uploadedById: actorUserId,
    fileName: "import.csv",
    fileSize: 2048,
    fileType: "csv",
    status: ImportJobStatus.PENDING,
    totalRows: 0,
    processedRows: 0,
    successfulRows: 0,
    failedRows: 0,
    errorReport: null,
    filePath: "/tmp/import.csv",
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      animalImportJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalImportJobRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repository = module.get<AnimalImportJobRepository>(AnimalImportJobRepository);
  });

  describe("create", () => {
    it("should create an import job record and return entity", async () => {
      (prisma.animalImportJob.create as jest.Mock).mockResolvedValueOnce(mockDbRecord);

      const entity = AnimalImportJobEntity.create({
        farmId,
        uploadedById: actorUserId,
        fileName: "import.csv",
        fileSize: 2048,
        fileType: "csv",
      });

      const result = await repository.create(entity);

      expect(prisma.animalImportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmId,
            fileName: "import.csv",
          }),
        })
      );
      expect(result.id).toBe(mockDbRecord.id);
      expect(result.status).toBe(ImportJobStatus.PENDING);
    });
  });

  describe("findById", () => {
    it("should return entity if found with farmId matching", async () => {
      (prisma.animalImportJob.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRecord);

      const result = await repository.findById(mockDbRecord.id, farmId);

      expect(prisma.animalImportJob.findFirst).toHaveBeenCalledWith({
        where: { id: mockDbRecord.id, farmId },
      });
      expect(result).not.toBeNull();
      expect(result?.fileName).toBe("import.csv");
    });

    it("should return null if record not found", async () => {
      (prisma.animalImportJob.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent", farmId);

      expect(result).toBeNull();
    });
  });

  describe("findByFarmId", () => {
    it("should return paginated list of import jobs", async () => {
      (prisma.animalImportJob.findMany as jest.Mock).mockResolvedValueOnce([mockDbRecord]);
      (prisma.animalImportJob.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findByFarmId(farmId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.animalImportJob.findMany).toHaveBeenCalledWith({
        where: { farmId },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("update", () => {
    it("should update job and return updated entity", async () => {
      const updatedRecord = {
        ...mockDbRecord,
        status: ImportJobStatus.COMPLETED,
        totalRows: 10,
        processedRows: 10,
        successfulRows: 10,
        failedRows: 0,
      };

      (prisma.animalImportJob.update as jest.Mock).mockResolvedValueOnce(updatedRecord);

      const entity = AnimalImportJobEntity.reconstitute({
        ...mockDbRecord,
        status: ImportJobStatus.COMPLETED,
        totalRows: 10,
        processedRows: 10,
        successfulRows: 10,
        failedRows: 0,
      });

      const result = await repository.update(entity);

      expect(prisma.animalImportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: entity.id },
        })
      );
      expect(result.status).toBe(ImportJobStatus.COMPLETED);
    });
  });
});
