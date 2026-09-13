import { Test, TestingModule } from "@nestjs/testing";
import {
  AnimalSpecies,
  AnimalStatus,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../../animals/repositories/animal.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { FarmRevenueEntity } from "../entities/farm-revenue.entity";
import {
  FARM_REVENUE_REPOSITORY,
  IFarmRevenueRepository,
} from "../repositories/farm-revenue.repository.interface";
import { FarmRevenueService } from "./farm-revenue.service";

describe("FarmRevenueService", () => {
  let service: FarmRevenueService;
  let farmRevenueRepository: jest.Mocked<IFarmRevenueRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const actorUserId = "22222222-2222-2222-2222-222222222222";
  const animalId = "44444444-4444-4444-4444-444444444444";

  const createMockEntity = (overrides?: Partial<FarmRevenueEntity>) => {
    return new FarmRevenueEntity({
      id: "55555555-5555-5555-5555-555555555555",
      farmId,
      recordedById: actorUserId,
      animalId,
      type: TransactionType.INCOME,
      category: TransactionCategory.MILK_SALES,
      amount: 3000,
      currency: "USD",
      referenceNote: "Milk collection payout",
      receiptUrl: null,
      metadata: {},
      txDate: new Date("2026-09-10"),
      syncVersion: 1,
      createdAt: new Date("2026-09-10T10:00:00Z"),
      updatedAt: new Date("2026-09-10T10:00:00Z"),
      deletedAt: null,
      animal: {
        id: animalId,
        tagNumber: "COW-01",
        name: "Bella",
        species: AnimalSpecies.COW,
      },
      recordedBy: {
        id: actorUserId,
        name: "Farmer Dave",
        email: "dave@farm.com",
      },
      ...overrides,
    });
  };

  beforeEach(async () => {
    const mockRevenueRepo = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      getSummary: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockAnimalRepo = {
      findById: jest.fn(),
      findByTagNumber: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findMany: jest.fn(),
    };

    const mockAuditRepo = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    const mockTxManager = {
      run: jest.fn().mockImplementation(async (fn) => fn({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmRevenueService,
        { provide: FARM_REVENUE_REPOSITORY, useValue: mockRevenueRepo },
        { provide: ANIMAL_REPOSITORY, useValue: mockAnimalRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
        { provide: TRANSACTION_MANAGER, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<FarmRevenueService>(FarmRevenueService);
    farmRevenueRepository = module.get(FARM_REVENUE_REPOSITORY);
    animalRepository = module.get(ANIMAL_REPOSITORY);
    auditLogRepository = module.get(AUDIT_LOG_REPOSITORY);
    transactionManager = module.get(TRANSACTION_MANAGER);
  });

  describe("recordRevenue", () => {
    it("should successfully record general revenue without animal", async () => {
      const mockEntity = createMockEntity();
      farmRevenueRepository.create.mockResolvedValue(mockEntity);

      const result = await service.recordRevenue(farmId, actorUserId, {
        category: TransactionCategory.MILK_SALES,
        amount: 3000,
        txDate: "2026-09-10",
        referenceNote: "Milk collection payout",
      });

      expect(transactionManager.run).toHaveBeenCalled();
      expect(farmRevenueRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "CREATE_REVENUE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
      expect(result.amount).toBe(3000);
      expect(result.category).toBe(TransactionCategory.MILK_SALES);
    });

    it("should transition animal to SOLD status when recording livestock sale", async () => {
      const mockAnimal = {
        id: animalId,
        tagNumber: "COW-01",
        status: AnimalStatus.ACTIVE,
        updateDetails: jest.fn(),
      } as any;
      animalRepository.findById.mockResolvedValue(mockAnimal);
      animalRepository.update.mockResolvedValue(mockAnimal);

      const mockEntity = createMockEntity({
        category: TransactionCategory.LIVESTOCK_SALES,
        amount: 1500,
      });
      farmRevenueRepository.create.mockResolvedValue(mockEntity);

      const result = await service.recordRevenue(farmId, actorUserId, {
        category: TransactionCategory.LIVESTOCK_SALES,
        amount: 1500,
        txDate: "2026-09-10",
        animalId,
        markAnimalAsSold: true,
      });

      expect(mockAnimal.updateDetails).toHaveBeenCalledWith({
        status: AnimalStatus.SOLD,
      });
      expect(animalRepository.update).toHaveBeenCalledWith(
        mockAnimal,
        expect.anything()
      );
      expect(result.category).toBe(TransactionCategory.LIVESTOCK_SALES);
    });

    it("should throw ValidationDomainException if animal is already SOLD", async () => {
      animalRepository.findById.mockResolvedValue({
        id: animalId,
        tagNumber: "COW-01",
        status: AnimalStatus.SOLD,
      } as any);

      await expect(
        service.recordRevenue(farmId, actorUserId, {
          category: TransactionCategory.LIVESTOCK_SALES,
          amount: 1500,
          txDate: "2026-09-10",
          animalId,
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if animal is DECEASED or CULLED", async () => {
      animalRepository.findById.mockResolvedValue({
        id: animalId,
        tagNumber: "COW-01",
        status: AnimalStatus.DECEASED,
      } as any);

      await expect(
        service.recordRevenue(farmId, actorUserId, {
          category: TransactionCategory.MANURE,
          amount: 200,
          txDate: "2026-09-10",
          animalId,
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("updateRevenue", () => {
    it("should successfully update revenue and log audit", async () => {
      const existing = createMockEntity();
      farmRevenueRepository.findById.mockResolvedValue(existing);
      farmRevenueRepository.update.mockResolvedValue(existing);

      const result = await service.updateRevenue(
        farmId,
        existing.id,
        actorUserId,
        {
          amount: 3200,
          syncVersion: 1,
        }
      );

      expect(farmRevenueRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "UPDATE_REVENUE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
      expect(result.amount).toBe(3200);
    });

    it("should throw EntityNotFoundException if revenue record not found", async () => {
      farmRevenueRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRevenue(farmId, "non-existent", actorUserId, {
          amount: 500,
          syncVersion: 1,
        })
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getRevenueById", () => {
    it("should return revenue DTO if found", async () => {
      const mockEntity = createMockEntity();
      farmRevenueRepository.findById.mockResolvedValue(mockEntity);

      const result = await service.getRevenueById(farmId, mockEntity.id);

      expect(result.id).toBe(mockEntity.id);
      expect(result.amount).toBe(3000);
    });

    it("should throw EntityNotFoundException if not found", async () => {
      farmRevenueRepository.findById.mockResolvedValue(null);

      await expect(
        service.getRevenueById(farmId, "non-existent")
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getRevenues", () => {
    it("should return paginated revenues", async () => {
      const mockEntity = createMockEntity();
      farmRevenueRepository.findMany.mockResolvedValue({
        items: [mockEntity],
        total: 1,
      });

      const result = await service.getRevenues(farmId, {
        page: 1,
        limit: 10,
        category: TransactionCategory.MILK_SALES,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("should throw ValidationDomainException if startDate > endDate", async () => {
      await expect(
        service.getRevenues(farmId, {
          startDate: "2026-09-30",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getRevenueSummary", () => {
    it("should return aggregated revenue analytics", async () => {
      const mockSummary = {
        startDate: "2026-08-14",
        endDate: "2026-09-13",
        currency: "USD",
        totalRevenue: 5000,
        totalTransactions: 2,
        topCategory: TransactionCategory.MILK_SALES,
        byCategory: [
          {
            category: TransactionCategory.MILK_SALES,
            totalAmount: 3500,
            transactionCount: 1,
            percentage: 70,
          },
          {
            category: TransactionCategory.MANURE,
            totalAmount: 1500,
            transactionCount: 1,
            percentage: 30,
          },
        ],
        timeline: [
          {
            date: "2026-09-10",
            amount: 5000,
            transactionCount: 2,
          },
        ],
      };

      farmRevenueRepository.getSummary.mockResolvedValue(mockSummary);

      const result = await service.getRevenueSummary(farmId, {
        startDate: "2026-08-14",
        endDate: "2026-09-13",
      });

      expect(result.totalRevenue).toBe(5000);
      expect(result.topCategory).toBe(TransactionCategory.MILK_SALES);
      expect(result.byCategory).toHaveLength(2);
    });
  });

  describe("deleteRevenue", () => {
    it("should soft-delete revenue and log audit inside transaction", async () => {
      const existing = createMockEntity();
      farmRevenueRepository.findById.mockResolvedValue(existing);
      farmRevenueRepository.softDelete.mockResolvedValue();

      await service.deleteRevenue(farmId, existing.id, actorUserId);

      expect(existing.isDeleted).toBe(true);
      expect(farmRevenueRepository.softDelete).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "DELETE_REVENUE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
    });
  });
});
