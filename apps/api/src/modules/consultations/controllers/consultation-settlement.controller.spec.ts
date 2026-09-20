import { UserRole, UserStatus } from "@vetralink/shared-types";
import { ForbiddenOperationException } from "../../../common/exceptions/domain.exception";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IVetPayoutLedgerService } from "../services/vet-payout-ledger.service.interface";
import { ConsultationSettlementController } from "./consultation-settlement.controller";

describe("ConsultationSettlementController", () => {
  let controller: ConsultationSettlementController;
  let mockPayoutService: jest.Mocked<IVetPayoutLedgerService>;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;

  const mockAdminUser = {
    sub: "admin-1",
    email: "admin@vetralink.com",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockVetUser = {
    sub: "vet-1",
    email: "dr.alice@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockOtherVetUser = {
    sub: "vet-2",
    email: "dr.bob@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockFarmerUser = {
    sub: "farmer-1",
    email: "farmer@dairyfarm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const sampleConsultation = ConsultationEntity.fromPersistence({
    id: "consult-1",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Respiratory signs",
    mediaUrls: [],
    type: "LIVE_VIDEO" as any,
    status: "COMPLETED" as any,
    roomSessionId: "room-1",
    feeCents: 5000,
    paymentStatus: "CAPTURED" as any,
    paymentIntentId: "pi_1",
    paymentHeldAt: new Date(),
    paymentCapturedAt: new Date(),
    paymentReleasedAt: null,
    currency: "USD",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockPayoutService = {
      calculateSplit: jest.fn().mockReturnValue({
        totalFeeCents: 5000,
        platformFeeRate: 0.2,
        platformFeeCents: 1000,
        vetPayoutCents: 4000,
        currency: "USD",
      }),
      recordConsultationSettlement: jest.fn().mockResolvedValue({
        id: "ledger-1",
        consultationId: "consult-1",
        vetId: "vet-1",
        totalFeeCents: 5000,
        platformFeeRate: 0.2,
        platformFeeCents: 1000,
        vetPayoutCents: 4000,
        currency: "USD",
        status: "PENDING" as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getVetPayoutLedger: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getVetEarningsSummary: jest.fn().mockResolvedValue({
        vetId: "vet-1",
        lifetimeGrossCents: 5000,
        lifetimePlatformFeeCents: 1000,
        lifetimeVetEarningsCents: 4000,
        pendingPayoutCents: 4000,
        paidPayoutCents: 0,
        totalSettledConsultations: 1,
        currency: "USD",
      }),
      getPlatformRevenueSummary: jest.fn().mockResolvedValue({
        totalGrossVolumeCents: 50000,
        totalPlatformFeesEarnedCents: 10000,
        totalVetPayoutsOwedCents: 20000,
        totalVetPayoutsPaidCents: 20000,
        totalSettledConsultations: 10,
        currency: "USD",
      }),
      processPayout: jest.fn().mockResolvedValue({
        id: "ledger-1",
        status: "PAID" as any,
      } as any),
      bulkProcessPayouts: jest.fn().mockResolvedValue({
        processedCount: 2,
        totalPaidCents: 8000,
      }),
    };

    mockConsultationRepo = {
      findById: jest.fn().mockResolvedValue(sampleConsultation),
    } as unknown as jest.Mocked<IConsultationRepository>;

    controller = new ConsultationSettlementController(
      mockPayoutService,
      mockConsultationRepo,
    );
  });

  describe("getPlatformRevenueSummary", () => {
    it("should return platform revenue summary", async () => {
      const result = await controller.getPlatformRevenueSummary(
        "2026-09-01",
        "2026-09-30",
      );
      expect(result.totalGrossVolumeCents).toBe(50000);
      expect(mockPayoutService.getPlatformRevenueSummary).toHaveBeenCalledWith({
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });
    });
  });

  describe("getMyEarnings", () => {
    it("should return summary and ledger for current vet", async () => {
      const result = await controller.getMyEarnings(mockVetUser, { page: 1 });
      expect(result.summary.vetId).toBe("vet-1");
      expect(mockPayoutService.getVetEarningsSummary).toHaveBeenCalledWith("vet-1");
      expect(mockPayoutService.getVetPayoutLedger).toHaveBeenCalledWith(
        "vet-1",
        { page: 1 },
      );
    });
  });

  describe("getVetEarnings", () => {
    it("should allow admin to view another vet's earnings", async () => {
      const result = await controller.getVetEarnings("vet-1", mockAdminUser, {});
      expect(result.summary).toBeDefined();
      expect(mockPayoutService.getVetEarningsSummary).toHaveBeenCalledWith("vet-1");
    });

    it("should allow a vet to view their own earnings", async () => {
      const result = await controller.getVetEarnings("vet-1", mockVetUser, {});
      expect(result.summary).toBeDefined();
    });

    it("should forbid a vet from viewing another vet's earnings", async () => {
      await expect(
        controller.getVetEarnings("vet-1", mockOtherVetUser, {}),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("getConsultationSettlement", () => {
    it("should allow assigned vet to view consultation settlement", async () => {
      const result = await controller.getConsultationSettlement(
        "consult-1",
        mockVetUser,
      );
      expect(result.consultationId).toBe("consult-1");
      expect(mockPayoutService.recordConsultationSettlement).toHaveBeenCalledWith(
        "consult-1",
      );
    });

    it("should allow farmer to view consultation settlement", async () => {
      const result = await controller.getConsultationSettlement(
        "consult-1",
        mockFarmerUser,
      );
      expect(result).toBeDefined();
    });

    it("should forbid unrelated user from viewing consultation settlement", async () => {
      await expect(
        controller.getConsultationSettlement("consult-1", mockOtherVetUser),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("previewFeeSplit", () => {
    it("should calculate and preview fee split", async () => {
      const result = await controller.previewFeeSplit("consult-1", "0.25");
      expect(result).toBeDefined();
      expect(mockPayoutService.calculateSplit).toHaveBeenCalledWith(5000, 0.25);
    });
  });

  describe("processPayout", () => {
    it("should call service to process payout", async () => {
      const result = await controller.processPayout(
        "ledger-1",
        mockAdminUser,
        { payoutReference: "REF-001" },
      );
      expect(result.status).toBe("PAID");
      expect(mockPayoutService.processPayout).toHaveBeenCalledWith(
        "ledger-1",
        { payoutReference: "REF-001" },
        "admin-1",
      );
    });
  });

  describe("bulkProcessPayouts", () => {
    it("should call service to bulk process payouts", async () => {
      const result = await controller.bulkProcessPayouts(mockAdminUser, {
        vetId: "vet-1",
        payoutIds: ["l-1", "l-2"],
        payoutBatchId: "BATCH-1",
      });
      expect(result.processedCount).toBe(2);
      expect(mockPayoutService.bulkProcessPayouts).toHaveBeenCalledWith(
        "vet-1",
        ["l-1", "l-2"],
        { payoutBatchId: "BATCH-1" },
        "admin-1",
      );
    });
  });
});
