import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmRevenueEntity } from "../entities/farm-revenue.entity";
import { FarmRevenueRepository } from "./farm-revenue.repository";

describe("FarmRevenueRepository", () => {
  let repository: FarmRevenueRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockDbRecord = {
    id: "44444444-4444-4444-4444-444444444444",
    farmId: "11111111-1111-1111-1111-111111111111",
    recordedById: "22222222-2222-2222-2222-222222222222",
    animalId: "55555555-5555-5555-5555-555555555555",
    type: "INCOME",
    category: "MILK_SALES",
    amount: new Prisma.Decimal(2500.0),
    currency: "USD",
    referenceNote: "Processor weekly payout",
    receiptUrl: null,
    metadata: {},
    txDate: new Date("2026-09-10"),
    syncVersion: 1,
    createdAt: new Date("2026-09-10T10:00:00Z"),
    updatedAt: new Date("2026-09-10T10:00:00Z"),
    deletedAt: null,
    animal: null,
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
        FarmRevenueRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<FarmRevenueRepository>(FarmRevenueRepository);
    prismaService = module.get(PrismaService);
  });

  it("should create a revenue record and return domain entity", async () => {
    (prismaService.farmTransaction.create as jest.Mock).mockResolvedValue(
      mockDbRecord
    );

    const entity = FarmRevenueEntity.create({
      farmId: mockDbRecord.farmId,
      recordedById: mockDbRecord.recordedById,
      category: TransactionCategory.MILK_SALES,
      amount: 2500.0,
      txDate: new Date("2026-09-10"),
    });

    const result = await repository.create(entity);

    expect(prismaService.farmTransaction.create).toHaveBeenCalled();
    expect(result.id).toBe(mockDbRecord.id);
    expect(result.amount).toBe(2500.0);
    expect(result.type).toBe(TransactionType.INCOME);
  });

  it("should update a revenue record", async () => {
    (prismaService.farmTransaction.update as jest.Mock).mockResolvedValue({
      ...mockDbRecord,
      amount: new Prisma.Decimal(2800.0),
      syncVersion: 2,
    });

    const entity = new FarmRevenueEntity({
      ...mockDbRecord,
      type: TransactionType.INCOME,
      category: TransactionCategory.MILK_SALES,
      amount: 2800.0,
      metadata: {},
      animal: null,
      recordedBy: mockDbRecord.recordedBy,
    });

    const result = await repository.update(entity);

    expect(prismaService.farmTransaction.update).toHaveBeenCalled();
    expect(result.amount).toBe(2800.0);
    expect(result.syncVersion).toBe(2);
  });

  it("should find an active revenue record by id and farmId", async () => {
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
        type: "INCOME",
        deletedAt: null,
      },
      include: expect.any(Object),
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockDbRecord.id);
  });

  it("should find many revenue records with pagination and filters", async () => {
    (prismaService.farmTransaction.count as jest.Mock).mockResolvedValue(1);
    (prismaService.farmTransaction.findMany as jest.Mock).mockResolvedValue([
      mockDbRecord,
    ]);

    const result = await repository.findMany({
      farmId: mockDbRecord.farmId,
      category: TransactionCategory.MILK_SALES,
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("should calculate summary breakdown for revenue categories and timeline", async () => {
    (prismaService.farmTransaction.findMany as jest.Mock).mockResolvedValue([
      {
        amount: new Prisma.Decimal(2000),
        category: "MILK_SALES",
        currency: "USD",
        txDate: new Date("2026-09-01"),
      },
      {
        amount: new Prisma.Decimal(1500),
        category: "LIVESTOCK_SALES",
        currency: "USD",
        txDate: new Date("2026-09-02"),
      },
      {
        amount: new Prisma.Decimal(500),
        category: "MANURE",
        currency: "USD",
        txDate: new Date("2026-09-02"),
      },
    ]);

    const summary = await repository.getSummary({
      farmId: mockDbRecord.farmId,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-10"),
    });

    expect(summary.totalRevenue).toBe(4000);
    expect(summary.totalTransactions).toBe(3);
    expect(summary.topCategory).toBe(TransactionCategory.MILK_SALES);
    expect(summary.byCategory).toHaveLength(3);

    const milkSummary = summary.byCategory.find(
      (c) => c.category === TransactionCategory.MILK_SALES
    );
    expect(milkSummary?.totalAmount).toBe(2000);
    expect(milkSummary?.percentage).toBe(50);
  });

  it("should soft-delete revenue record", async () => {
    (prismaService.farmTransaction.update as jest.Mock).mockResolvedValue({});

    const entity = FarmRevenueEntity.create({
      farmId: mockDbRecord.farmId,
      recordedById: mockDbRecord.recordedById,
      category: TransactionCategory.MANURE,
      amount: 300,
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
