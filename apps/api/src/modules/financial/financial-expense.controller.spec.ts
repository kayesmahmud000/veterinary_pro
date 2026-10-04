import { Test, TestingModule } from "@nestjs/testing";
import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { Reflector } from "@nestjs/core";
import { FinancialExpenseController } from "./financial-expense.controller";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import {
  FARM_EXPENSE_SERVICE,
  IFarmExpenseService,
} from "./services/farm-expense.service.interface";

describe("FinancialExpenseController", () => {
  let controller: FinancialExpenseController;
  let expenseService: jest.Mocked<IFarmExpenseService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const expenseId = "33333333-3333-3333-3333-333333333333";

  const mockUser = {
    sub: userId,
    email: "owner@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockExpenseDto = {
    id: expenseId,
    farmId,
    recordedById: userId,
    animalId: null,
    type: TransactionType.EXPENSE,
    category: TransactionCategory.FEED,
    amount: 750.0,
    currency: "USD",
    referenceNote: "Purchased silage",
    receiptUrl: null,
    metadata: {},
    txDate: "2026-09-10",
    syncVersion: 1,
    createdAt: "2026-09-10T10:00:00Z",
    updatedAt: "2026-09-10T10:00:00Z",
  };

  beforeEach(async () => {
    const mockService = {
      recordExpense: jest.fn(),
      updateExpense: jest.fn(),
      getExpenseById: jest.fn(),
      getExpenses: jest.fn(),
      getExpenseSummary: jest.fn(),
      deleteExpense: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialExpenseController],
      providers: [
        {
          provide: FARM_EXPENSE_SERVICE,
          useValue: mockService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findMembership: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<FinancialExpenseController>(
      FinancialExpenseController
    );
    expenseService = module.get(FARM_EXPENSE_SERVICE);
  });

  it("should record an expense", async () => {
    expenseService.recordExpense.mockResolvedValue(mockExpenseDto);

    const dto = {
      category: TransactionCategory.FEED,
      amount: 750.0,
      txDate: "2026-09-10",
      referenceNote: "Purchased silage",
    };

    const result = await controller.recordExpense(
      farmId,
      mockUser,
      dto,
      "trace-1"
    );

    expect(expenseService.recordExpense).toHaveBeenCalledWith(
      farmId,
      userId,
      dto,
      "trace-1"
    );
    expect(result).toEqual(mockExpenseDto);
  });

  it("should get expense summary analytics", async () => {
    const mockSummary = {
      startDate: "2026-08-14",
      endDate: "2026-09-13",
      currency: "USD",
      totalExpense: 750,
      totalTransactions: 1,
      topCategory: TransactionCategory.FEED,
      byCategory: [
        {
          category: TransactionCategory.FEED,
          totalAmount: 750,
          transactionCount: 1,
          percentage: 100,
        },
      ],
      timeline: [
        {
          date: "2026-09-10",
          amount: 750,
          transactionCount: 1,
        },
      ],
    };

    expenseService.getExpenseSummary.mockResolvedValue(mockSummary);

    const query = { startDate: "2026-08-14", endDate: "2026-09-13" };
    const result = await controller.getExpenseSummary(farmId, query);

    expect(expenseService.getExpenseSummary).toHaveBeenCalledWith(
      farmId,
      query
    );
    expect(result.totalExpense).toBe(750);
  });

  it("should list paginated expenses", async () => {
    const mockPaginated = {
      items: [mockExpenseDto],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    expenseService.getExpenses.mockResolvedValue(mockPaginated);

    const query = { page: 1, limit: 20 };
    const result = await controller.listExpenses(farmId, query);

    expect(expenseService.getExpenses).toHaveBeenCalledWith(farmId, query);
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("should get single expense by id", async () => {
    expenseService.getExpenseById.mockResolvedValue(mockExpenseDto);

    const result = await controller.getExpenseById(farmId, expenseId);

    expect(expenseService.getExpenseById).toHaveBeenCalledWith(
      farmId,
      expenseId
    );
    expect(result.id).toBe(expenseId);
  });

  it("should update an expense", async () => {
    const updatedDto = { ...mockExpenseDto, amount: 800.0, syncVersion: 2 };
    expenseService.updateExpense.mockResolvedValue(updatedDto);

    const updateBody = { amount: 800.0, syncVersion: 1 };
    const result = await controller.updateExpense(
      farmId,
      mockUser,
      expenseId,
      updateBody,
      "trace-2"
    );

    expect(expenseService.updateExpense).toHaveBeenCalledWith(
      farmId,
      expenseId,
      userId,
      updateBody,
      "trace-2"
    );
    expect(result.amount).toBe(800.0);
    expect(result.syncVersion).toBe(2);
  });

  it("should delete an expense", async () => {
    expenseService.deleteExpense.mockResolvedValue();

    await controller.deleteExpense(farmId, mockUser, expenseId, "trace-3");

    expect(expenseService.deleteExpense).toHaveBeenCalledWith(
      farmId,
      expenseId,
      userId,
      "trace-3"
    );
  });
});
