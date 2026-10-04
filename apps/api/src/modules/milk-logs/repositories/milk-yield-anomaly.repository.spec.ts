import { Prisma } from "@prisma/client";
import {
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { MilkYieldAnomalyEntity } from "../entities/milk-yield-anomaly.entity";
import { MilkYieldAnomalyRepository } from "./milk-yield-anomaly.repository";

describe("MilkYieldAnomalyRepository", () => {
  let repository: MilkYieldAnomalyRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const anomalyId = "33333333-3333-3333-3333-333333333333";
  const loggedDate = new Date("2026-09-13T00:00:00.000Z");

  const mockDbRow = {
    id: anomalyId,
    farmId,
    animalId,
    loggedDate,
    currentYieldLiters: new Prisma.Decimal(12.0),
    baselineYieldLiters: new Prisma.Decimal(20.0),
    dropPercentage: new Prisma.Decimal(40.0),
    severity: "MEDIUM" as const,
    status: "DETECTED" as const,
    acknowledgedById: null,
    acknowledgedAt: null,
    resolvedAt: null,
    clinicalNotes: null,
    resolutionNotes: null,
    metadata: { baselineActiveDays: 5 },
    createdAt: new Date(),
    updatedAt: new Date(),
    animal: {
      id: animalId,
      tagNumber: "COW-001",
      name: "Bella",
      species: "COW",
      breed: "Holstein",
    },
    acknowledgedBy: null,
  };

  beforeEach(() => {
    prisma = {
      milkYieldAnomaly: {
        upsert: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new MilkYieldAnomalyRepository(prisma);
  });

  describe("upsert", () => {
    it("should upsert anomaly record and return entity", async () => {
      (prisma.milkYieldAnomaly.upsert as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const entity = MilkYieldAnomalyEntity.create({
        farmId,
        animalId,
        loggedDate,
        currentYieldLiters: 12.0,
        baselineYieldLiters: 20.0,
        dropPercentage: 40.0,
        severity: MilkAnomalySeverity.MEDIUM,
      });

      const result = await repository.upsert(entity);

      expect(prisma.milkYieldAnomaly.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            farmId_animalId_loggedDate: {
              farmId,
              animalId,
              loggedDate,
            },
          },
        })
      );
      expect(result.id).toBe(mockDbRow.id);
      expect(result.dropPercentage).toBe(40.0);
    });
  });

  describe("findById", () => {
    it("should return anomaly entity if found", async () => {
      (prisma.milkYieldAnomaly.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(anomalyId, farmId);

      expect(prisma.milkYieldAnomaly.findFirst).toHaveBeenCalledWith({
        where: { id: anomalyId, farmId },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe(anomalyId);
      expect(result!.animal?.tagNumber).toBe("COW-001");
    });

    it("should return null if not found", async () => {
      (prisma.milkYieldAnomaly.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById(anomalyId, farmId);
      expect(result).toBeNull();
    });
  });

  describe("findByAnimalAndDate", () => {
    it("should return anomaly if found for animal on date", async () => {
      (prisma.milkYieldAnomaly.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findByAnimalAndDate(farmId, animalId, loggedDate);

      expect(prisma.milkYieldAnomaly.findFirst).toHaveBeenCalledWith({
        where: { farmId, animalId, loggedDate },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe(anomalyId);
    });
  });

  describe("findMany", () => {
    it("should return paginated anomalies with total count", async () => {
      (prisma.milkYieldAnomaly.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);
      (prisma.milkYieldAnomaly.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findMany(farmId, {
        status: MilkAnomalyStatus.DETECTED,
        page: 1,
        limit: 10,
      });

      expect(prisma.milkYieldAnomaly.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId,
            status: MilkAnomalyStatus.DETECTED,
          }),
          skip: 0,
          take: 10,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("save", () => {
    it("should update entity fields and return domain entity", async () => {
      const updatedRow = {
        ...mockDbRow,
        status: "ACKNOWLEDGED" as const,
        acknowledgedById: "vet-1",
        acknowledgedAt: new Date(),
      };
      (prisma.milkYieldAnomaly.update as jest.Mock).mockResolvedValueOnce(updatedRow);

      const entity = new MilkYieldAnomalyEntity({
        id: anomalyId,
        farmId,
        animalId,
        loggedDate,
        currentYieldLiters: 12.0,
        baselineYieldLiters: 20.0,
        dropPercentage: 40.0,
        severity: MilkAnomalySeverity.MEDIUM,
        status: MilkAnomalyStatus.ACKNOWLEDGED,
        acknowledgedById: "vet-1",
        acknowledgedAt: new Date(),
        resolvedAt: null,
        clinicalNotes: "Checked",
        resolutionNotes: null,
      });

      const result = await repository.save(entity);

      expect(prisma.milkYieldAnomaly.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: anomalyId },
        })
      );
      expect(result.status).toBe(MilkAnomalyStatus.ACKNOWLEDGED);
    });
  });
});
