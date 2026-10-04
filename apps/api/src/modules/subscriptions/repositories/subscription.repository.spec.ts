import { SubscriptionStatus, SubscriptionTier } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { SubscriptionRepository } from "./subscription.repository";

describe("SubscriptionRepository", () => {
  let repository: SubscriptionRepository;
  let mockPrisma: any;

  const mockDbRecord = {
    id: "sub-12345",
    userId: "user-123",
    farmId: "farm-123",
    planId: "plan-123",
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
    gatewaySubId: "sub_gateway_123",
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    plan: {
      id: "plan-123",
      name: "Pro Farmer",
      tier: SubscriptionTier.PRO,
      priceMonthlyCents: 900,
      priceAnnualCents: 8900,
      maxAnimals: 30,
      features: {
        maxAnimals: 30,
        maxStaff: 3,
        teleVetPriority: "EXPEDITED",
        advancedAnalytics: true,
        bulkImportExport: true,
        customReports: false,
      },
      isActive: true,
      createdAt: new Date("2026-09-01T00:00:00Z"),
    },
  };

  beforeEach(() => {
    mockPrisma = {
      subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    repository = new SubscriptionRepository(mockPrisma as unknown as PrismaService);
  });

  describe("findById()", () => {
    it("should return mapped entity with plan if found", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockDbRecord);

      const result = await repository.findById(mockDbRecord.id);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: mockDbRecord.id },
        include: {
          plan: true,
          user: { select: { id: true, name: true, email: true } },
          farm: { select: { id: true, name: true } },
        },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockDbRecord.id);
      expect(result?.plan?.name).toBe("Pro Farmer");
    });

    it("should return null if not found", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("findByFarmId()", () => {
    it("should return latest subscription for farm", async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockDbRecord);

      const result = await repository.findByFarmId(mockDbRecord.farmId);

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { farmId: mockDbRecord.farmId },
        include: { plan: true },
        orderBy: { updatedAt: "desc" },
      });
      expect(result?.farmId).toBe(mockDbRecord.farmId);
    });
  });

  describe("findByUserId()", () => {
    it("should return all subscriptions for user", async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findByUserId(mockDbRecord.userId);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: mockDbRecord.userId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });
      expect(results).toHaveLength(1);
    });
  });

  describe("findByGatewaySubId()", () => {
    it("should return subscription matching gateway ID", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockDbRecord);

      const result = await repository.findByGatewaySubId(mockDbRecord.gatewaySubId);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { gatewaySubId: mockDbRecord.gatewaySubId },
        include: { plan: true },
      });
      expect(result?.gatewaySubId).toBe(mockDbRecord.gatewaySubId);
    });
  });

  describe("save()", () => {
    it("should upsert subscription into database", async () => {
      const entity = SubscriptionEntity.fromPersistence(mockDbRecord);
      mockPrisma.subscription.upsert.mockResolvedValue(mockDbRecord);

      const result = await repository.save(entity);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { id: entity.id },
        create: expect.objectContaining({
          id: entity.id,
          userId: entity.userId,
          status: entity.status,
        }),
        update: expect.objectContaining({
          status: entity.status,
        }),
        include: { plan: true },
      });
      expect(result.id).toBe(entity.id);
    });
  });

  describe("findExpiredSubscriptions()", () => {
    it("should return active/trialing/past-due subscriptions past their period end", async () => {
      const now = new Date("2026-10-02T00:00:00Z");
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findExpiredSubscriptions(now);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.TRIALING,
              SubscriptionStatus.PAST_DUE,
            ],
          },
          currentPeriodEnd: { lte: now },
        },
        include: { plan: true },
        take: 100,
      });
      expect(results).toHaveLength(1);
    });
  });

  describe("findPastDueSubscriptions()", () => {
    it("should return all subscriptions with status PAST_DUE", async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findPastDueSubscriptions();

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.PAST_DUE,
        },
        include: {
          plan: true,
          user: { select: { id: true, name: true, email: true } },
          farm: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "asc" },
      });
      expect(results).toHaveLength(1);
    });
  });

  describe("findAllWithPlan()", () => {
    it("should return all subscriptions with plan included", async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findAllWithPlan();

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          plan: true,
          user: { select: { id: true, name: true, email: true } },
          farm: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.plan?.tier).toBe(SubscriptionTier.PRO);
    });

    it("should filter by asOfDate when provided", async () => {
      const asOfDate = new Date("2026-09-15T00:00:00Z");
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findAllWithPlan(asOfDate);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { createdAt: { lte: asOfDate } },
        include: {
          plan: true,
          user: { select: { id: true, name: true, email: true } },
          farm: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(results).toHaveLength(1);
    });
  });

  describe("findHistoricalSubscriptions()", () => {
    it("should query subscriptions overlapping the specified date range", async () => {
      const start = new Date("2026-08-01T00:00:00Z");
      const end = new Date("2026-09-01T00:00:00Z");
      mockPrisma.subscription.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findHistoricalSubscriptions(start, end);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lte: end },
          OR: [
            { currentPeriodEnd: { gte: start } },
            { updatedAt: { gte: start } },
          ],
        },
        include: {
          plan: true,
          user: { select: { id: true, name: true, email: true } },
          farm: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(results).toHaveLength(1);
    });
  });
});
