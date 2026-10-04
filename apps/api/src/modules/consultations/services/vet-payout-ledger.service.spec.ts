import { PayoutStatus } from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ConsultationEntity } from "../entities/consultation.entity";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IPayoutLedgerRepository } from "../repositories/payout-ledger.repository.interface";
import { VetPayoutLedgerService } from "./vet-payout-ledger.service";

describe("VetPayoutLedgerService", () => {
  let service: VetPayoutLedgerService;
  let mockPayoutLedgerRepo: jest.Mocked<IPayoutLedgerRepository>;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;

  const mockConsultation = ConsultationEntity.fromPersistence({
    id: "consult-101",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow with fever and respiratory distress",
    mediaUrls: [],
    type: "LIVE_VIDEO" as any,
    status: "COMPLETED" as any,
    roomSessionId: "room-101",
    feeCents: 5000, // $50.00
    paymentStatus: "CAPTURED" as any,
    paymentIntentId: "pi_test_101",
    paymentHeldAt: new Date(),
    paymentCapturedAt: new Date(),
    paymentReleasedAt: null,
    currency: "USD",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockPayoutLedgerRepo = {
      create: jest.fn().mockImplementation(async (e) => e),
      save: jest.fn().mockImplementation(async (e) => e),
      findById: jest.fn(),
      findByConsultationId: jest.fn(),
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findPendingByVetId: jest.fn().mockResolvedValue([]),
      findEarningsSummary: jest.fn(),
      findPlatformRevenueSummary: jest.fn(),
    };

    mockConsultationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    service = new VetPayoutLedgerService(
      mockPayoutLedgerRepo,
      mockConsultationRepo,
      mockAuditLogRepo,
    );
  });

  describe("calculateSplit", () => {
    it("should calculate exact 80/20 fee split by default", () => {
      const split = service.calculateSplit(5000);
      expect(split.totalFeeCents).toBe(5000);
      expect(split.platformFeeRate).toBe(0.2);
      expect(split.platformFeeCents).toBe(1000); // 20% of 5000
      expect(split.vetPayoutCents).toBe(4000); // 80% of 5000
      expect(split.platformFeeCents + split.vetPayoutCents).toBe(5000);
    });

    it("should handle odd amounts with exact integer cent math (no fraction loss)", () => {
      const split = service.calculateSplit(2999);
      // 2999 * 0.20 = 599.8 -> Math.round -> 600
      expect(split.platformFeeCents).toBe(600);
      expect(split.vetPayoutCents).toBe(2399);
      expect(split.platformFeeCents + split.vetPayoutCents).toBe(2999);
    });

    it("should support custom platform fee rate", () => {
      const split = service.calculateSplit(10000, 0.15); // 15% platform fee
      expect(split.platformFeeRate).toBe(0.15);
      expect(split.platformFeeCents).toBe(1500);
      expect(split.vetPayoutCents).toBe(8500);
    });

    it("should handle zero fee consultations", () => {
      const split = service.calculateSplit(0);
      expect(split.platformFeeCents).toBe(0);
      expect(split.vetPayoutCents).toBe(0);
    });

    it("should throw ValidationDomainException on negative fee", () => {
      expect(() => service.calculateSplit(-100)).toThrow(
        ValidationDomainException,
      );
    });

    it("should throw ValidationDomainException on invalid platform rate", () => {
      expect(() => service.calculateSplit(1000, -0.1)).toThrow(
        ValidationDomainException,
      );
      expect(() => service.calculateSplit(1000, 1.5)).toThrow(
        ValidationDomainException,
      );
    });
  });

  describe("recordConsultationSettlement", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.recordConsultationSettlement("non-existent"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if consultation has no assigned vet", async () => {
      const unassigned = ConsultationEntity.fromPersistence({
        ...mockConsultation,
        vetId: null,
      } as any);
      mockConsultationRepo.findById.mockResolvedValue(unassigned);

      await expect(
        service.recordConsultationSettlement("consult-101"),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should return existing settlement if already recorded (idempotency)", async () => {
      mockConsultationRepo.findById.mockResolvedValue(mockConsultation);
      const existing = PayoutLedgerEntity.create({
        consultationId: "consult-101",
        vetId: "vet-1",
        totalFeeCents: 5000,
      });
      mockPayoutLedgerRepo.findByConsultationId.mockResolvedValue(existing);

      const result = await service.recordConsultationSettlement("consult-101");
      expect(result.consultationId).toBe("consult-101");
      expect(mockPayoutLedgerRepo.create).not.toHaveBeenCalled();
      expect(mockAuditLogRepo.record).not.toHaveBeenCalled();
    });

    it("should create payout ledger record and emit audit log", async () => {
      mockConsultationRepo.findById.mockResolvedValue(mockConsultation);
      mockPayoutLedgerRepo.findByConsultationId.mockResolvedValue(null);

      const result = await service.recordConsultationSettlement(
        "consult-101",
        undefined,
        "trace-settle-1",
      );

      expect(result).toBeDefined();
      expect(result.totalFeeCents).toBe(5000);
      expect(result.platformFeeCents).toBe(1000);
      expect(result.vetPayoutCents).toBe(4000);
      expect(result.status).toBe(PayoutStatus.PENDING);
      expect(mockPayoutLedgerRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "VET_CONSULTATION_SETTLED",
          userId: "vet-1",
          traceId: "trace-settle-1",
        }),
      );
    });
  });

  describe("getVetEarningsSummary", () => {
    it("should return aggregated earnings from repository", async () => {
      const summary = {
        vetId: "vet-1",
        lifetimeGrossCents: 25000,
        lifetimePlatformFeeCents: 5000,
        lifetimeVetEarningsCents: 20000,
        pendingPayoutCents: 8000,
        paidPayoutCents: 12000,
        totalSettledConsultations: 5,
        currency: "USD",
      };
      mockPayoutLedgerRepo.findEarningsSummary.mockResolvedValue(summary);

      const result = await service.getVetEarningsSummary("vet-1");
      expect(result).toEqual(summary);
      expect(mockPayoutLedgerRepo.findEarningsSummary).toHaveBeenCalledWith("vet-1");
    });
  });

  describe("getPlatformRevenueSummary", () => {
    it("should return platform revenue summary from repository", async () => {
      const summary = {
        totalGrossVolumeCents: 100000,
        totalPlatformFeesEarnedCents: 20000,
        totalVetPayoutsOwedCents: 30000,
        totalVetPayoutsPaidCents: 50000,
        totalSettledConsultations: 20,
        currency: "USD",
      };
      mockPayoutLedgerRepo.findPlatformRevenueSummary.mockResolvedValue(summary);

      const result = await service.getPlatformRevenueSummary();
      expect(result).toEqual(summary);
      expect(mockPayoutLedgerRepo.findPlatformRevenueSummary).toHaveBeenCalled();
    });
  });

  describe("processPayout", () => {
    it("should throw EntityNotFoundException if payout ledger does not exist", async () => {
      mockPayoutLedgerRepo.findById.mockResolvedValue(null);

      await expect(
        service.processPayout("non-existent", {}, "admin-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should transition payout to PAID and emit audit log", async () => {
      const ledger = PayoutLedgerEntity.create({
        consultationId: "consult-101",
        vetId: "vet-1",
        totalFeeCents: 5000,
      });
      mockPayoutLedgerRepo.findById.mockResolvedValue(ledger);

      const result = await service.processPayout(
        ledger.id,
        {
          payoutReference: "WIRE-REF-9988",
          payoutBatchId: "BATCH-2026-09",
        },
        "admin-1",
        "trace-pay-1",
      );

      expect(result.status).toBe(PayoutStatus.PAID);
      expect(result.payoutReference).toBe("WIRE-REF-9988");
      expect(result.payoutBatchId).toBe("BATCH-2026-09");
      expect(mockPayoutLedgerRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "VET_PAYOUT_PROCESSED",
          userId: "admin-1",
          traceId: "trace-pay-1",
        }),
      );
    });
  });

  describe("bulkProcessPayouts", () => {
    it("should process multiple payouts for a target veterinarian", async () => {
      const ledger1 = PayoutLedgerEntity.create({
        id: "ledger-1",
        consultationId: "consult-1",
        vetId: "vet-1",
        totalFeeCents: 5000, // 4000 vet payout
      });
      const ledger2 = PayoutLedgerEntity.create({
        id: "ledger-2",
        consultationId: "consult-2",
        vetId: "vet-1",
        totalFeeCents: 3000, // 2400 vet payout
      });

      mockPayoutLedgerRepo.findById
        .mockResolvedValueOnce(ledger1)
        .mockResolvedValueOnce(ledger2);

      const result = await service.bulkProcessPayouts(
        "vet-1",
        ["ledger-1", "ledger-2"],
        { payoutBatchId: "BATCH-BULK-01" },
        "admin-1",
      );

      expect(result.processedCount).toBe(2);
      expect(result.totalPaidCents).toBe(6400); // 4000 + 2400
      expect(ledger1.status).toBe(PayoutStatus.PAID);
      expect(ledger2.status).toBe(PayoutStatus.PAID);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "VET_PAYOUT_BULK_PROCESSED",
          userId: "admin-1",
        }),
      );
    });
  });
});
