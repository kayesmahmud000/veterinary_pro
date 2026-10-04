import { Test, TestingModule } from "@nestjs/testing";
import {
  OrderStatus,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
} from "@vetralink/shared-types";
import { EntitlementService } from "./entitlement.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";

describe("EntitlementService (Unit)", () => {
  let service: EntitlementService;
  let prisma: {
    product: { findUnique: jest.Mock };
    orderItem: { findFirst: jest.Mock };
    subscription: { findFirst: jest.Mock };
  };

  const mockProductId = "11111111-1111-4111-8111-111111111111";
  const mockUserId = "user-2222-2222-2222-222222222222";

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn() },
      orderItem: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<EntitlementService>(EntitlementService);
  });

  describe("checkEntitlement", () => {
    it("should grant access immediately for SUPER_ADMIN role without querying database", async () => {
      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.SUPER_ADMIN,
        mockProductId
      );

      expect(result).toBe(true);
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it("should grant access immediately for ADMIN role without querying database", async () => {
      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.ADMIN,
        mockProductId
      );

      expect(result).toBe(true);
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException if product does not exist", async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.checkEntitlement(mockUserId, UserRole.FARMER, mockProductId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw EntityNotFoundException if product is soft-deleted", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: new Date(),
        isPublished: true,
      });

      await expect(
        service.checkEntitlement(mockUserId, UserRole.FARMER, mockProductId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should deny access if product is not published and user is not admin", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: null,
        isPublished: false,
      });

      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.FARMER,
        mockProductId
      );

      expect(result).toBe(false);
    });

    it("should grant access if user has purchased the product via completed order", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: null,
        isPublished: true,
        minSubscriptionTier: SubscriptionTier.PRO,
      });

      prisma.orderItem.findFirst.mockResolvedValue({
        id: "order-item-1",
      });

      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.FARMER,
        mockProductId
      );

      expect(result).toBe(true);
      expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
        where: {
          productId: mockProductId,
          order: {
            userId: mockUserId,
            status: OrderStatus.COMPLETED,
          },
        },
        select: { id: true },
      });
    });

    it("should grant access if user has an active subscription with sufficient tier", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: null,
        isPublished: true,
        minSubscriptionTier: SubscriptionTier.STARTER,
      });

      prisma.orderItem.findFirst.mockResolvedValue(null);

      prisma.subscription.findFirst.mockResolvedValue({
        id: "sub-1",
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        plan: {
          tier: SubscriptionTier.PRO, // PRO > STARTER
        },
      });

      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.VET,
        mockProductId
      );

      expect(result).toBe(true);
    });

    it("should deny access if user subscription tier is lower than product required tier", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: null,
        isPublished: true,
        minSubscriptionTier: SubscriptionTier.ENTERPRISE,
      });

      prisma.orderItem.findFirst.mockResolvedValue(null);

      prisma.subscription.findFirst.mockResolvedValue({
        id: "sub-1",
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        plan: {
          tier: SubscriptionTier.PRO, // PRO < ENTERPRISE
        },
      });

      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.FARMER,
        mockProductId
      );

      expect(result).toBe(false);
    });

    it("should deny access if user has neither completed purchase nor active subscription", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: mockProductId,
        deletedAt: null,
        isPublished: true,
        minSubscriptionTier: SubscriptionTier.STARTER,
      });

      prisma.orderItem.findFirst.mockResolvedValue(null);
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.checkEntitlement(
        mockUserId,
        UserRole.FARMER,
        mockProductId
      );

      expect(result).toBe(false);
    });
  });
});
