import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmExpenseEntity } from "../entities/farm-expense.entity";
import { FarmExpenseRepository } from "./farm-expense.repository";

describe("FarmExpenseRepository", () => {
  let repository: FarmExpenseRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockDbRecord = {
    id: "33333333-3333-3333-3333-333333333333",
    farmId: "11111111-1111-1111-1111-111111111111",
    recordedById: "22222222-2222-2222-2222-222222222222",
    animalId: "44444444-4444-4444-4444-444444444444",
    type: "EXPENSE",
    category: "FEED",
    amount: new Prisma.Decimal(500.0),
    currency: "USD",
    referenceNote: "Bulk corn and soy meal",
    receiptUrl: null,
    metadata: {},
    txDate: new Date("2026-09-10"),
    syncVersion: 1,
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
    deletedAt: null,
    animal: {
      id: "44444444-4444-4444-4444-444444444444",
      tagNumber: "COW-01",
      name: "Bella",
      species: "COW",
    },
    recordedBy: {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Farmer Dave",
      email: "dave@farm.com",
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      farmTransaction: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmExpenseRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<FarmExpenseRepository>(FarmExpenseRepository);
    prismaService = module.get(PrismaService);
  });

  it("should create a farm transaction record and return domain entity", async () => {
    (prismaService.farmTransaction.create as jest.Mock).mockResolvedValue(
      mockDbRecord
    );

    const entity = FarmExpenseEntity.create({
      farmId: mockDbRecord.farmId,
      recordedById: mockDbRecord.recordedById,
      category: TransactionCategory.FEED,
      amount: 500.0,
      txDate: new Date("2026-09-10"),
    });

    const result = await repository.create(entity);

    expect(prismaService.farmTransaction.create).toHaveBeenCalled();
    expect(result.id).toBe(mockDbRecord.id);
    expect(result.amount).toBe(500.0);
    expect(result.animal?.tagNumber).toBe("COW-01");
    expect(result.recordedBy?.name).toBe("Farmer Dave");
  });

  it("should update a farm transaction record", async () => {
    (prismaService.farmTransaction.update as jest.Mock).mockResolvedValue({
      ...mockDbRecord,
      amount: new Prisma.Decimal(650.0),
      syncVersion: 2,
    });

    const entity = new FarmExpenseEntity({
      ...mockDbRecord,
      type: TransactionType.EXPENSE,
      category: TransactionCategory.FEED,
      amount: 650.0,
      metadata: {},
      animal: {
        id: mockDbRecord.animal.id,
        tagNumber: mockDbRecord.animal.tagNumber,
        name: mockDbRecord.animal.name,
        species: AnimalSpecies.COW,
      },
      recordedBy: mockDbRecord.recordedBy,
    });

    const result = await repository.update(entity);

    expect(prismaService.farmTransaction.update).toHaveBeenCalled();
    expect(result.amount).toBe(650.0);
    expect(result.syncVersion).toBe(2);
  });

  it("should find an active expense by id and farmId", async () => {
    (prismaService.farmTransaction.findFirst as jest.Mock).mockResolvedValue(
      mockDbRecord
    );

    const result = await repository.findById(
      mockDbRecord.id,
      mockDbRecord.farmId
    );

    expect(prismaService.farmTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockDbRecord.id,
        farmId: mockDbRecord.farmId,
        type: "EXPENSE",
        deletedAt: null,
      },
      include: expect.any(Object),
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockDbRecord.id);
  });

  it("should return null if expense not found", async () => {
    (prismaService.farmTransaction.findFirst as jest.Mock).mockResolvedValue(
      null
    );

    const result = await repository.findById("non-existent", "farm-1");

    expect(result).toBeNull();
  });

  it("should find many expenses with filters and pagination", async () => {
    (prismaService.farmTransaction.count as jest.Mock).mockResolvedValue(1);
    (prismaService.farmTransaction.findMany as jest.Mock).mockResolvedValue([
      mockDbRecord,
    ]);

    const result = await repository.findMany({
      farmId: mockDbRecord.farmId,
      category: TransactionCategory.FEED,
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(mockDbRecord.id);
  });

  it("should aggregate expense summary and breakdown by category and timeline", async () => {
    (prismaService.farmTransaction.findMany as jest.Mock).mockResolvedValue([
      {
        amount: new Prisma.Decimal(300),
        category: "FEED",
        currency: "USD",
        txDate: new Date("2026-09-01"),
      },
      {
        amount: new Prisma.Decimal(200),
        category: "FEED",
        currency: "USD",
        txDate: new Date("2026-09-01"),
      },
      {
        amount: new Prisma.Decimal(100),
        category: "MEDICINE",
        currency: "USD",
        txDate: new Date("2026-09-02"),
      },
      {
        amount: new Prisma.Decimal(400),
        category: "UTILITY",
        currency: "USD",
        txDate: new Date("2026-09-03"),
      },
    ]);

    const summary = await repository.getSummary({
      farmId: mockDbRecord.farmId,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-10"),
    });

    expect(summary.totalExpense).toBe(1000);
    expect(summary.totalTransactions).toBe(4);
    expect(summary.topCategory).toBe(TransactionCategory.FEED); // 500 FEED vs 400 UTILITY vs 100 MEDICINE
    expect(summary.byCategory).toHaveLength(3);

    const feedSummary = summary.byCategory.find(
      (c) => c.category === TransactionCategory.FEED
    );
    expect(feedSummary?.totalAmount).toBe(500);
    expect(feedSummary?.transactionCount).toBe(2);
    expect(feedSummary?.percentage).toBe(50);

    expect(summary.timeline).toHaveLength(3);
  });

  it("should soft delete an expense", async () => {
    (prismaService.farmTransaction.update as jest.Mock).mockResolvedValue({});

    const entity = FarmExpenseEntity.create({
      farmId: mockDbRecord.farmId,
      recordedById: mockDbRecord.recordedById,
      category: TransactionCategory.FEED,
      amount: 100,
      txDate: new Date(),
    });

    entity.softDelete();

    await repository.softDelete(entity);

    expect(prismaService.farmTransaction.update).toHaveBeenCalledWith({
      where: { id: entity.id },
      data: {
        deletedAt: entity.deletedAt,
        syncVersion: entity.syncVersion,
        updatedAt: entity.updatedAt,
      },
    });
  });
});
