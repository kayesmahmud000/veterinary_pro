import { SubscriptionTier, DEFAULT_SUBSCRIPTION_PLANS } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionPlanRepository } from "./subscription-plan.repository";

describe("SubscriptionPlanRepository", () => {
  let repository: SubscriptionPlanRepository;
  let mockPrisma: any;

  const mockDbRecord = {
    id: "b3b2ec62-9fa9-43c7-8bb3-dcf742f9a712",
    name: "Pro Farmer",
    tier: "PRO",
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
  };

  beforeEach(() => {
    mockPrisma = {
      subscriptionPlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    repository = new SubscriptionPlanRepository(mockPrisma as unknown as PrismaService);
  });

  describe("findAll()", () => {
    it("should return only active plans by default", async () => {
      mockPrisma.subscriptionPlan.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findAll(false);

      expect(mockPrisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceMonthlyCents: "asc" },
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.tier).toBe(SubscriptionTier.PRO);
    });

    it("should return all plans including inactive when requested", async () => {
      mockPrisma.subscriptionPlan.findMany.mockResolvedValue([mockDbRecord]);

      const results = await repository.findAll(true);

      expect(mockPrisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { priceMonthlyCents: "asc" },
      });
      expect(results).toHaveLength(1);
    });
  });

  describe("findById()", () => {
    it("should return entity if found", async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockDbRecord);

      const result = await repository.findById(mockDbRecord.id);

      expect(mockPrisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { id: mockDbRecord.id },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockDbRecord.id);
    });

    it("should return null if not found", async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("findByTier()", () => {
    it("should return entity matching tier", async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockDbRecord);

      const result = await repository.findByTier(SubscriptionTier.PRO);

      expect(mockPrisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { tier: SubscriptionTier.PRO },
      });
      expect(result?.tier).toBe(SubscriptionTier.PRO);
    });
  });

  describe("save()", () => {
    it("should upsert plan entity into database", async () => {
      const plan = SubscriptionPlanEntity.fromPersistence(mockDbRecord);
      mockPrisma.subscriptionPlan.upsert.mockResolvedValue(mockDbRecord);

      const saved = await repository.save(plan);

      expect(mockPrisma.subscriptionPlan.upsert).toHaveBeenCalledWith({
        where: { id: plan.id },
        create: expect.objectContaining({
          id: plan.id,
          name: plan.name,
          tier: plan.tier,
          priceMonthlyCents: plan.priceMonthlyCents,
        }),
        update: expect.objectContaining({
          name: plan.name,
          priceMonthlyCents: plan.priceMonthlyCents,
        }),
      });
      expect(saved.id).toBe(plan.id);
    });
  });

  describe("upsertDefaultPlans()", () => {
    it("should create new plans when they do not exist", async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: "generated-id",
          ...args.data,
          createdAt: new Date(),
        }),
      );

      const results = await repository.upsertDefaultPlans(DEFAULT_SUBSCRIPTION_PLANS);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(3);
      expect(mockPrisma.subscriptionPlan.create).toHaveBeenCalledTimes(3);
    });

    it("should update existing plans when they already exist", async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockDbRecord);
      mockPrisma.subscriptionPlan.update.mockImplementation((args: any) =>
        Promise.resolve({
          id: mockDbRecord.id,
          ...args.data,
          createdAt: mockDbRecord.createdAt,
        }),
      );

      const results = await repository.upsertDefaultPlans(DEFAULT_SUBSCRIPTION_PLANS);

      expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
    });
  });
});
