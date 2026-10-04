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
import { FarmExpenseEntity } from "../entities/farm-expense.entity";
import {
  FARM_EXPENSE_REPOSITORY,
  IFarmExpenseRepository,
} from "../repositories/farm-expense.repository.interface";
import { FarmExpenseService } from "./farm-expense.service";

describe("FarmExpenseService", () => {
  let service: FarmExpenseService;
  let farmExpenseRepository: jest.Mocked<IFarmExpenseRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const actorUserId = "22222222-2222-2222-2222-222222222222";
  const animalId = "44444444-4444-4444-4444-444444444444";

  const createMockEntity = (overrides?: Partial<FarmExpenseEntity>) => {
    return new FarmExpenseEntity({
      id: "33333333-3333-3333-3333-333333333333",
      farmId,
      recordedById: actorUserId,
      animalId,
      type: TransactionType.EXPENSE,
      category: TransactionCategory.FEED,
      amount: 500,
      currency: "USD",
      referenceNote: "Dairy Feed",
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
    const mockExpenseRepo = {
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
        FarmExpenseService,
        { provide: FARM_EXPENSE_REPOSITORY, useValue: mockExpenseRepo },
        { provide: ANIMAL_REPOSITORY, useValue: mockAnimalRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
        { provide: TRANSACTION_MANAGER, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<FarmExpenseService>(FarmExpenseService);
    farmExpenseRepository = module.get(FARM_EXPENSE_REPOSITORY);
    animalRepository = module.get(ANIMAL_REPOSITORY);
    auditLogRepository = module.get(AUDIT_LOG_REPOSITORY);
    transactionManager = module.get(TRANSACTION_MANAGER);
  });

  describe("recordExpense", () => {
    it("should successfully record an expense without animal", async () => {
      const mockEntity = createMockEntity();
      farmExpenseRepository.create.mockResolvedValue(mockEntity);

      const result = await service.recordExpense(farmId, actorUserId, {
        category: TransactionCategory.FEED,
        amount: 500,
        txDate: "2026-09-10",
        referenceNote: "Dairy Feed",
      });

      expect(transactionManager.run).toHaveBeenCalled();
      expect(farmExpenseRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "CREATE_EXPENSE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
      expect(result.amount).toBe(500);
      expect(result.category).toBe(TransactionCategory.FEED);
    });

    it("should verify animal when animalId is provided", async () => {
      const mockAnimal = {
        id: animalId,
        tagNumber: "COW-01",
        status: AnimalStatus.ACTIVE,
      } as any;
      animalRepository.findById.mockResolvedValue(mockAnimal);

      const mockEntity = createMockEntity();
      farmExpenseRepository.create.mockResolvedValue(mockEntity);

      const result = await service.recordExpense(farmId, actorUserId, {
        category: TransactionCategory.MEDICINE,
        amount: 120,
        txDate: "2026-09-10",
        animalId,
      });

      expect(animalRepository.findById).toHaveBeenCalledWith(animalId, farmId);
      expect(result.id).toBe(mockEntity.id);
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValue(null);

      await expect(
        service.recordExpense(farmId, actorUserId, {
          category: TransactionCategory.MEDICINE,
          amount: 120,
          txDate: "2026-09-10",
          animalId: "non-existent-animal",
        })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if animal is SOLD or DECEASED", async () => {
      animalRepository.findById.mockResolvedValue({
        id: animalId,
        tagNumber: "COW-01",
        status: AnimalStatus.SOLD,
      } as any);

      await expect(
        service.recordExpense(farmId, actorUserId, {
          category: TransactionCategory.MEDICINE,
          amount: 120,
          txDate: "2026-09-10",
          animalId,
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("updateExpense", () => {
    it("should successfully update an expense and log audit", async () => {
      const existing = createMockEntity();
      farmExpenseRepository.findById.mockResolvedValue(existing);
      farmExpenseRepository.update.mockResolvedValue(existing);

      const result = await service.updateExpense(
        farmId,
        existing.id,
        actorUserId,
        {
          amount: 550,
          syncVersion: 1,
        }
      );

      expect(farmExpenseRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "UPDATE_EXPENSE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
      expect(result.amount).toBe(550);
    });

    it("should throw EntityNotFoundException if expense does not exist", async () => {
      farmExpenseRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateExpense(farmId, "non-existent", actorUserId, {
          amount: 100,
          syncVersion: 1,
        })
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getExpenseById", () => {
    it("should return expense DTO if found", async () => {
      const mockEntity = createMockEntity();
      farmExpenseRepository.findById.mockResolvedValue(mockEntity);

      const result = await service.getExpenseById(farmId, mockEntity.id);

      expect(result.id).toBe(mockEntity.id);
      expect(result.amount).toBe(500);
    });

    it("should throw EntityNotFoundException if not found", async () => {
      farmExpenseRepository.findById.mockResolvedValue(null);

      await expect(
        service.getExpenseById(farmId, "non-existent")
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getExpenses", () => {
    it("should return paginated expenses", async () => {
      const mockEntity = createMockEntity();
      farmExpenseRepository.findMany.mockResolvedValue({
        items: [mockEntity],
        total: 1,
      });

      const result = await service.getExpenses(farmId, {
        page: 1,
        limit: 10,
        category: TransactionCategory.FEED,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("should throw ValidationDomainException if startDate > endDate", async () => {
      await expect(
        service.getExpenses(farmId, {
          startDate: "2026-09-30",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getExpenseSummary", () => {
    it("should return summary breakdown from repository", async () => {
      const mockSummary = {
        startDate: "2026-08-14",
        endDate: "2026-09-13",
        currency: "USD",
        totalExpense: 1500,
        totalTransactions: 5,
        topCategory: TransactionCategory.FEED,
        byCategory: [
          {
            category: TransactionCategory.FEED,
            totalAmount: 1000,
            transactionCount: 3,
            percentage: 66.67,
          },
        ],
        timeline: [
          {
            date: "2026-09-10",
            amount: 1000,
            transactionCount: 3,
          },
        ],
      };

      farmExpenseRepository.getSummary.mockResolvedValue(mockSummary);

      const result = await service.getExpenseSummary(farmId, {
        startDate: "2026-08-14",
        endDate: "2026-09-13",
      });

      expect(result.totalExpense).toBe(1500);
      expect(result.topCategory).toBe(TransactionCategory.FEED);
    });
  });

  describe("deleteExpense", () => {
    it("should soft-delete expense and record audit log inside transaction", async () => {
      const existing = createMockEntity();
      farmExpenseRepository.findById.mockResolvedValue(existing);
      farmExpenseRepository.softDelete.mockResolvedValue();

      await service.deleteExpense(farmId, existing.id, actorUserId);

      expect(existing.isDeleted).toBe(true);
      expect(farmExpenseRepository.softDelete).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "DELETE_EXPENSE",
          entityType: "FarmTransaction",
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException if expense does not exist", async () => {
      farmExpenseRepository.findById.mockResolvedValue(null);

      await expect(
        service.deleteExpense(farmId, "non-existent", actorUserId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
