import { Prisma } from "@prisma/client";
import { HealthEventType, SeverityLevel } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthRecordEntity } from "../entities/health-record.entity";
import { HealthRecordRepository } from "./health-record.repository";

describe("HealthRecordRepository", () => {
  let repository: HealthRecordRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";
  const vetId = "44444444-4444-4444-4444-444444444444";

  const mockDbRow = {
    id: "55555555-5555-5555-5555-555555555555",
    farmId,
    animalId,
    recordedById: userId,
    attendingVetId: vetId,
    eventType: "ILLNESS" as const,
    severity: "HIGH" as const,
    symptoms: "Lethargy and nasal discharge",
    diagnosis: "Bovine viral diarrhea",
    treatment: "Isolate and administer supportive fluids",
    cost: new Prisma.Decimal(120.5),
    resolvedAt: null,
    syncVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    animal: {
      id: animalId,
      tagNumber: "COW-101",
      name: "Bella",
      species: "COW",
      breed: "Angus",
      gender: "FEMALE",
    },
    recordedBy: {
      id: userId,
      name: "John Herdsman",
      email: "john@farm.com",
      role: "HERDSMAN",
    },
    attendingVet: {
      id: vetId,
      name: "Dr. Vet",
      email: "vet@vetralink.pro",
      role: "VET",
    },
  };

  const mockEntity = HealthRecordEntity.create({
    id: mockDbRow.id,
    farmId,
    animalId,
    recordedById: userId,
    attendingVetId: vetId,
    eventType: HealthEventType.ILLNESS,
    severity: SeverityLevel.HIGH,
    symptoms: mockDbRow.symptoms,
    diagnosis: mockDbRow.diagnosis,
    treatment: mockDbRow.treatment,
    cost: 120.5,
  });

  beforeEach(() => {
    prisma = {
      healthRecord: {
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new HealthRecordRepository(prisma);
  });

  describe("create", () => {
    it("should create a health record and return domain entity", async () => {
      (prisma.healthRecord.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.healthRecord.create).toHaveBeenCalled();
      expect(result.id).toBe(mockDbRow.id);
      expect(result.symptoms).toBe(mockDbRow.symptoms);
      expect(result.cost).toBe(120.5);
      expect(result.animal?.tagNumber).toBe("COW-101");
      expect(result.attendingVet?.name).toBe("Dr. Vet");
    });
  });

  describe("findById", () => {
    it("should return domain entity when record exists", async () => {
      (prisma.healthRecord.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(mockDbRow.id, farmId);

      expect(prisma.healthRecord.findFirst).toHaveBeenCalledWith({
        where: { id: mockDbRow.id, farmId },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockDbRow.id);
    });

    it("should return null when record does not exist", async () => {
      (prisma.healthRecord.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent", farmId);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update record and return updated domain entity", async () => {
      const updatedRow = {
        ...mockDbRow,
        severity: "CRITICAL" as const,
        cost: new Prisma.Decimal(250.0),
        syncVersion: 2,
      };
      (prisma.healthRecord.update as jest.Mock).mockResolvedValueOnce(updatedRow);

      mockEntity.update({
        severity: SeverityLevel.CRITICAL,
        cost: 250.0,
      });

      const result = await repository.update(mockEntity);

      expect(prisma.healthRecord.update).toHaveBeenCalled();
      expect(result.severity).toBe(SeverityLevel.CRITICAL);
      expect(result.cost).toBe(250.0);
      expect(result.syncVersion).toBe(2);
    });
  });

  describe("findMany", () => {
    it("should filter by animalId, eventType, severity and isResolved", async () => {
      (prisma.healthRecord.count as jest.Mock).mockResolvedValueOnce(1);
      (prisma.healthRecord.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const result = await repository.findMany(farmId, {
        animalId,
        eventType: HealthEventType.ILLNESS,
        severity: SeverityLevel.HIGH,
        isResolved: false,
        page: 1,
        limit: 10,
      });

      expect(prisma.healthRecord.count).toHaveBeenCalledWith({
        where: {
          farmId,
          animalId,
          eventType: HealthEventType.ILLNESS,
          severity: SeverityLevel.HIGH,
          resolvedAt: null,
        },
      });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(mockDbRow.id);
    });
  });

  describe("delete", () => {
    it("should delete record scoped to farmId", async () => {
      (prisma.healthRecord.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

      await repository.delete(mockDbRow.id, farmId);

      expect(prisma.healthRecord.deleteMany).toHaveBeenCalledWith({
        where: { id: mockDbRow.id, farmId },
      });
    });
  });

  describe("findUnresolvedCriticalCases", () => {
    it("should query unresolved critical and high incidents excluding inactive animals", async () => {
      (prisma.healthRecord.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const asOf = new Date();
      const result = await repository.findUnresolvedCriticalCases(farmId, asOf);

      expect(prisma.healthRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          farmId,
          resolvedAt: null,
          severity: {
            in: ["CRITICAL", "HIGH"],
          },
          animal: {
            status: {
              notIn: ["SOLD", "DECEASED", "CULLED"],
            },
            deletedAt: null,
          },
          createdAt: { lte: asOf },
        }),
        orderBy: { createdAt: "asc" },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(mockDbRow.id);
    });
  });
});
