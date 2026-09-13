import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import {
  TransactionCategory,
  TransactionType,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { FinancialRevenueController } from "./financial-revenue.controller";
import {
  FARM_REVENUE_SERVICE,
  IFarmRevenueService,
} from "./services/farm-revenue.service.interface";

describe("FinancialRevenueController", () => {
  let controller: FinancialRevenueController;
  let revenueService: jest.Mocked<IFarmRevenueService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const userId = "22222222-2222-2222-2222-222222222222";
  const revenueId = "55555555-5555-5555-5555-555555555555";

  const mockUser = {
    sub: userId,
    email: "owner@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockRevenueDto = {
    id: revenueId,
    farmId,
    recordedById: userId,
    animalId: null,
    type: TransactionType.INCOME,
    category: TransactionCategory.MILK_SALES,
    amount: 4500.0,
    currency: "USD",
    referenceNote: "Bulk milk sale invoice #MS-88",
    receiptUrl: null,
    metadata: {},
    txDate: "2026-09-10",
    syncVersion: 1,
    createdAt: "2026-09-10T10:00:00Z",
    updatedAt: "2026-09-10T10:00:00Z",
  };

  beforeEach(async () => {
    const mockService = {
      recordRevenue: jest.fn(),
      updateRevenue: jest.fn(),
      getRevenueById: jest.fn(),
      getRevenues: jest.fn(),
      getRevenueSummary: jest.fn(),
      deleteRevenue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialRevenueController],
      providers: [
        {
          provide: FARM_REVENUE_SERVICE,
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

    controller = module.get<FinancialRevenueController>(
      FinancialRevenueController
    );
    revenueService = module.get(FARM_REVENUE_SERVICE);
  });

  it("should record revenue", async () => {
    revenueService.recordRevenue.mockResolvedValue(mockRevenueDto);

    const dto = {
      category: TransactionCategory.MILK_SALES,
      amount: 4500.0,
      txDate: "2026-09-10",
      referenceNote: "Bulk milk sale invoice #MS-88",
    };

    const result = await controller.recordRevenue(
      farmId,
      mockUser,
      dto,
      "trace-1"
    );

    expect(revenueService.recordRevenue).toHaveBeenCalledWith(
      farmId,
      userId,
      dto,
      "trace-1"
    );
    expect(result).toEqual(mockRevenueDto);
  });

  it("should get revenue summary analytics", async () => {
    const mockSummary = {
      startDate: "2026-08-14",
      endDate: "2026-09-13",
      currency: "USD",
      totalRevenue: 4500,
      totalTransactions: 1,
      topCategory: TransactionCategory.MILK_SALES,
      byCategory: [
        {
          category: TransactionCategory.MILK_SALES,
          totalAmount: 4500,
          transactionCount: 1,
          percentage: 100,
        },
      ],
      timeline: [
        {
          date: "2026-09-10",
          amount: 4500,
          transactionCount: 1,
        },
      ],
    };

    revenueService.getRevenueSummary.mockResolvedValue(mockSummary);

    const query = { startDate: "2026-08-14", endDate: "2026-09-13" };
    const result = await controller.getRevenueSummary(farmId, query);

    expect(revenueService.getRevenueSummary).toHaveBeenCalledWith(
      farmId,
      query
    );
    expect(result.totalRevenue).toBe(4500);
  });

  it("should list paginated revenues", async () => {
    const mockPaginated = {
      items: [mockRevenueDto],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    revenueService.getRevenues.mockResolvedValue(mockPaginated);

    const query = { page: 1, limit: 20 };
    const result = await controller.listRevenues(farmId, query);

    expect(revenueService.getRevenues).toHaveBeenCalledWith(farmId, query);
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("should get single revenue by id", async () => {
    revenueService.getRevenueById.mockResolvedValue(mockRevenueDto);

    const result = await controller.getRevenueById(farmId, revenueId);

    expect(revenueService.getRevenueById).toHaveBeenCalledWith(
      farmId,
      revenueId
    );
    expect(result.id).toBe(revenueId);
  });

  it("should update a revenue record", async () => {
    const updatedDto = { ...mockRevenueDto, amount: 4800.0, syncVersion: 2 };
    revenueService.updateRevenue.mockResolvedValue(updatedDto);

    const updateBody = { amount: 4800.0, syncVersion: 1 };
    const result = await controller.updateRevenue(
      farmId,
      mockUser,
      revenueId,
      updateBody,
      "trace-2"
    );

    expect(revenueService.updateRevenue).toHaveBeenCalledWith(
      farmId,
      revenueId,
      userId,
      updateBody,
      "trace-2"
    );
    expect(result.amount).toBe(4800.0);
    expect(result.syncVersion).toBe(2);
  });

  it("should delete a revenue record", async () => {
    revenueService.deleteRevenue.mockResolvedValue();

    await controller.deleteRevenue(farmId, mockUser, revenueId, "trace-3");

    expect(revenueService.deleteRevenue).toHaveBeenCalledWith(
      farmId,
      revenueId,
      userId,
      "trace-3"
    );
  });
});
