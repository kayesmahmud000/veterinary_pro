import { Prisma } from "@prisma/client";
import { MilkSession } from "@vetralink/shared-types";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { MilkLogEntity } from "../entities/milk-log.entity";
import { MilkLogRepository } from "./milk-log.repository";

describe("MilkLogRepository", () => {
  let repository: MilkLogRepository;
  let prisma: jest.Mocked<PrismaService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const userId = "33333333-3333-3333-3333-333333333333";

  const mockDbRow = {
    id: "44444444-4444-4444-4444-444444444444",
    farmId,
    animalId,
    recordedById: userId,
    session: "MORNING" as const,
    yieldLiters: new Prisma.Decimal(14.5),
    fatPercent: new Prisma.Decimal(3.8),
    snfPercent: new Prisma.Decimal(8.5),
    loggedDate: new Date("2026-09-13T00:00:00.000Z"),
    syncVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    animal: {
      id: animalId,
      tagNumber: "COW-001",
      name: "Daisy",
      species: "COW",
      breed: "Holstein",
    },
    recordedBy: {
      id: userId,
      name: "John Herdsman",
      email: "john@farm.com",
    },
  };

  const mockEntity = MilkLogEntity.create({
    id: mockDbRow.id,
    farmId,
    animalId,
    recordedById: userId,
    session: MilkSession.MORNING,
    yieldLiters: 14.5,
    fatPercent: 3.8,
    snfPercent: 8.5,
    loggedDate: mockDbRow.loggedDate,
  });

  beforeEach(() => {
    prisma = {
      milkLog: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new MilkLogRepository(prisma);
  });

  describe("create", () => {
    it("should create record and return MilkLogEntity", async () => {
      (prisma.milkLog.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.milkLog.create).toHaveBeenCalled();
      expect(result.id).toBe(mockDbRow.id);
      expect(result.yieldLiters).toBe(14.5);
      expect(result.session).toBe(MilkSession.MORNING);
      expect(result.animal?.tagNumber).toBe("COW-001");
    });

    it("should map P2002 to EntityConflictException", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" }
      );
      (prisma.milkLog.create as jest.Mock).mockRejectedValueOnce(p2002Error);

      await expect(repository.create(mockEntity)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("update", () => {
    it("should update record and return updated MilkLogEntity", async () => {
      (prisma.milkLog.update as jest.Mock).mockResolvedValueOnce({
        ...mockDbRow,
        yieldLiters: new Prisma.Decimal(16.0),
      });

      mockEntity.update({ yieldLiters: 16.0 });
      const result = await repository.update(mockEntity);

      expect(prisma.milkLog.update).toHaveBeenCalled();
      expect(result.yieldLiters).toBe(16.0);
    });
  });

  describe("findById", () => {
    it("should return MilkLogEntity if found", async () => {
      (prisma.milkLog.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(mockDbRow.id, farmId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockDbRow.id);
    });

    it("should return null if not found", async () => {
      (prisma.milkLog.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("unknown-id", farmId);

      expect(result).toBeNull();
    });
  });

  describe("findBulkBySessionAndDate", () => {
    it("should return MilkLogEntity with animalId null when found", async () => {
      const mockBulkDbRow = {
        ...mockDbRow,
        animalId: null,
        animal: null,
      };
      (prisma.milkLog.findFirst as jest.Mock).mockResolvedValueOnce(mockBulkDbRow);

      const result = await repository.findBulkBySessionAndDate(
        farmId,
        new Date("2026-09-13"),
        MilkSession.MORNING
      );

      expect(result).not.toBeNull();
      expect(result?.isBulk).toBe(true);
      expect(result?.animalId).toBeNull();
      expect(prisma.milkLog.findFirst).toHaveBeenCalledWith({
        where: {
          farmId,
          animalId: null,
          loggedDate: new Date("2026-09-13"),
          session: MilkSession.MORNING,
        },
        include: expect.anything(),
      });
    });
  });

  describe("findMany", () => {
    it("should return paginated items and total count", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);
      (prisma.milkLog.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findMany(farmId, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]!.id).toBe(mockDbRow.id);
    });

    it("should filter by entryType BULK (animalId IS NULL)", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.milkLog.count as jest.Mock).mockResolvedValueOnce(0);

      await repository.findMany(farmId, {
        entryType: "BULK",
        page: 1,
        limit: 10,
      });

      expect(prisma.milkLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId,
            animalId: null,
          }),
        })
      );
    });
  });

  describe("delete", () => {
    it("should delete record by id and farmId", async () => {
      (prisma.milkLog.delete as jest.Mock).mockResolvedValueOnce(mockDbRow);

      await repository.delete(mockDbRow.id, farmId);

      expect(prisma.milkLog.delete).toHaveBeenCalledWith({
        where: {
          id: mockDbRow.id,
          farmId,
        },
      });
    });
  });

  describe("findLogsForAnalytics", () => {
    it("should query logs ordered by loggedDate asc, session asc with date range and return domain entities", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const startDate = new Date("2026-09-01T00:00:00.000Z");
      const endDate = new Date("2026-09-13T00:00:00.000Z");

      const results = await repository.findLogsForAnalytics(farmId, {
        startDate,
        endDate,
        animalId,
      });

      expect(prisma.milkLog.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          animalId,
          loggedDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ loggedDate: "asc" }, { session: "asc" }],
        include: expect.any(Object),
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(mockDbRow.id);
      expect(results[0]!.yieldLiters).toBe(14.5);
    });

    it("should filter by entryType BULK (animalId is null)", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([]);

      const startDate = new Date("2026-09-01T00:00:00.000Z");
      const endDate = new Date("2026-09-13T00:00:00.000Z");

      await repository.findLogsForAnalytics(farmId, {
        startDate,
        endDate,
        entryType: "BULK",
      });

      expect(prisma.milkLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId,
            animalId: null,
          }),
        })
      );
    });
  });

  describe("findLogsForExport", () => {
    it("should query logs with date range, session, and take limit", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const startDate = new Date("2026-09-01T00:00:00.000Z");
      const endDate = new Date("2026-09-13T00:00:00.000Z");

      const results = await repository.findLogsForExport(farmId, {
        startDate,
        endDate,
        session: MilkSession.MORNING,
        limit: 1000,
      });

      expect(prisma.milkLog.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          session: MilkSession.MORNING,
          loggedDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        take: 1000,
        orderBy: [{ loggedDate: "asc" }, { session: "asc" }],
        include: expect.any(Object),
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(mockDbRow.id);
    });

    it("should enforce maximum limit of 10000 records", async () => {
      (prisma.milkLog.findMany as jest.Mock).mockResolvedValueOnce([]);

      await repository.findLogsForExport(farmId, {
        limit: 50000,
      });

      expect(prisma.milkLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10000,
        })
      );
    });
  });
});
