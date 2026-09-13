import { Prisma } from "@prisma/client";
import {
  PreventativeScheduleStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";
import { VaccineRecordRepository } from "./vaccine-record.repository";

describe("VaccineRecordRepository", () => {
  let repository: VaccineRecordRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  const mockDbRow = {
    id: "44444444-4444-4444-4444-444444444444",
    farmId,
    animalId,
    administeredBy: userId,
    recordType: "VACCINATION" as const,
    vaccineName: "Anthrax Spore Vaccine",
    batchNumber: "ANT-2026-X1",
    doseAmount: new Prisma.Decimal(1.0),
    doseUnit: "ml",
    cost: new Prisma.Decimal(12.5),
    notes: "Subcutaneous injection",
    administeredAt: new Date("2026-09-01T00:00:00.000Z"),
    nextDueDate: new Date("2027-09-01T00:00:00.000Z"),
    syncVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    animal: {
      id: animalId,
      tagNumber: "COW-042",
      name: "Buttercup",
      species: "COW",
      breed: "Jersey",
      gender: "FEMALE",
    },
    recorder: {
      id: userId,
      name: "Dr. Vet",
      email: "vet@farm.com",
      role: "VET",
    },
  };

  const mockEntity = VaccineRecordEntity.create({
    id: mockDbRow.id,
    farmId,
    animalId,
    administeredById: userId,
    recordType: VaccineRecordType.VACCINATION,
    vaccineName: mockDbRow.vaccineName,
    batchNumber: mockDbRow.batchNumber,
    doseAmount: 1.0,
    cost: 12.5,
    administeredAt: mockDbRow.administeredAt,
    nextDueDate: mockDbRow.nextDueDate,
  });

  beforeEach(() => {
    prisma = {
      vaccineRecord: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new VaccineRecordRepository(prisma);
  });

  describe("create", () => {
    it("should create record and return domain entity", async () => {
      (prisma.vaccineRecord.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.vaccineRecord.create).toHaveBeenCalled();
      expect(result.id).toBe(mockDbRow.id);
      expect(result.vaccineName).toBe(mockDbRow.vaccineName);
      expect(result.animal?.tagNumber).toBe("COW-042");
    });
  });

  describe("findById", () => {
    it("should return domain entity when found", async () => {
      (prisma.vaccineRecord.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(mockDbRow.id, farmId);

      expect(prisma.vaccineRecord.findFirst).toHaveBeenCalledWith({
        where: { id: mockDbRow.id, farmId },
        include: expect.any(Object),
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockDbRow.id);
    });

    it("should return null when record does not exist", async () => {
      (prisma.vaccineRecord.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent", farmId);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update record and return updated entity", async () => {
      const updatedRow = {
        ...mockDbRow,
        doseAmount: new Prisma.Decimal(2.0),
        syncVersion: 2,
      };
      (prisma.vaccineRecord.update as jest.Mock).mockResolvedValueOnce(updatedRow);

      mockEntity.update({ doseAmount: 2.0 });
      const result = await repository.update(mockEntity);

      expect(prisma.vaccineRecord.update).toHaveBeenCalled();
      expect(result.doseAmount).toBe(2.0);
      expect(result.syncVersion).toBe(2);
    });
  });

  describe("findMany", () => {
    it("should filter by recordType and status", async () => {
      (prisma.vaccineRecord.count as jest.Mock).mockResolvedValueOnce(1);
      (prisma.vaccineRecord.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const result = await repository.findMany(farmId, {
        animalId,
        recordType: VaccineRecordType.VACCINATION,
        status: PreventativeScheduleStatus.UPCOMING,
        page: 1,
        limit: 10,
        asOfDate: new Date("2026-09-13"),
      });

      expect(prisma.vaccineRecord.count).toHaveBeenCalled();
      expect(prisma.vaccineRecord.findMany).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe(mockDbRow.id);
    });
  });

  describe("getScheduleCounts", () => {
    it("should return aggregated counts for dashboard", async () => {
      (prisma.vaccineRecord.count as jest.Mock)
        .mockResolvedValueOnce(150) // totalRecords
        .mockResolvedValueOnce(100) // totalVaccinations
        .mockResolvedValueOnce(50)  // totalDewormings
        .mockResolvedValueOnce(5)   // dueNext7Days
        .mockResolvedValueOnce(25)  // dueNext30Days
        .mockResolvedValueOnce(8);  // overdueCount

      const counts = await repository.getScheduleCounts(farmId, new Date("2026-09-13"));

      expect(counts.totalRecords).toBe(150);
      expect(counts.totalVaccinations).toBe(100);
      expect(counts.totalDewormings).toBe(50);
      expect(counts.dueNext7Days).toBe(5);
      expect(counts.dueNext30Days).toBe(25);
      expect(counts.overdueCount).toBe(8);
    });
  });

  describe("findRecordsForReminderScan", () => {
    it("should query records due within horizon excluding sold/deceased/culled animals", async () => {
      (prisma.vaccineRecord.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const records = await repository.findRecordsForReminderScan(farmId, 7, new Date("2026-09-13"));

      expect(prisma.vaccineRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          farmId,
          nextDueDate: expect.objectContaining({ not: null }),
          animal: expect.objectContaining({
            status: expect.objectContaining({ notIn: expect.any(Array) }),
          }),
        }),
        orderBy: { nextDueDate: "asc" },
        include: expect.anything(),
      });
      expect(records).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("should delete record scoped to farmId", async () => {
      (prisma.vaccineRecord.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

      await repository.delete(mockDbRow.id, farmId);

      expect(prisma.vaccineRecord.deleteMany).toHaveBeenCalledWith({
        where: { id: mockDbRow.id, farmId },
      });
    });
  });
});
