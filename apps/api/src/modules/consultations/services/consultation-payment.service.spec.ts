import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IConsultationPaymentGateway } from "./consultation-payment-gateway.interface";
import { ConsultationPaymentService } from "./consultation-payment.service";

describe("ConsultationPaymentService", () => {
  let service: ConsultationPaymentService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockPaymentGateway: jest.Mocked<IConsultationPaymentGateway>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;
  let mockVetPayoutLedgerService: any;

  const createSampleConsultation = (props?: Partial<any>) => {
    return ConsultationEntity.fromPersistence({
      id: "consult-1",
      farmerId: "farmer-1",
      vetId: null,
      farmId: "farm-1",
      animalId: "animal-1",
      chiefComplaint: "Cow has severe fever and respiratory issues.",
      mediaUrls: [],
      type: ConsultationType.LIVE_VIDEO,
      status: ConsultationStatus.SUBMITTED,
      roomSessionId: null,
      feeCents: 3000,
      paymentStatus: ConsultationPaymentStatus.UNPAID,
      paymentIntentId: null,
      paymentHeldAt: null,
      paymentCapturedAt: null,
      paymentReleasedAt: null,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
    });
  };

  beforeEach(() => {
    mockConsultationRepo = {
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockPaymentGateway = {
      gatewayName: "mock",
      createAuthorizationHold: jest.fn().mockResolvedValue({
        paymentIntentId: "pi_hold_test_123",
        clientSecret: "secret_test_123",
        amountCents: 3000,
        currency: "USD",
      }),
      captureHold: jest.fn().mockResolvedValue({
        paymentIntentId: "pi_hold_test_123",
        amountCents: 3000,
        captured: true,
      }),
      releaseHold: jest.fn().mockResolvedValue({
        paymentIntentId: "pi_hold_test_123",
        released: true,
      }),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ email: "farmer@test.com" }),
      },
    };

    mockVetPayoutLedgerService = {
      recordConsultationSettlement: jest.fn().mockResolvedValue({}),
      calculateSplit: jest.fn(),
      getVetPayoutLedger: jest.fn(),
      getVetEarningsSummary: jest.fn(),
      getPlatformRevenueSummary: jest.fn(),
      processPayout: jest.fn(),
      bulkProcessPayouts: jest.fn(),
    };

    service = new ConsultationPaymentService(
      mockConsultationRepo,
      mockPaymentGateway,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
      mockVetPayoutLedgerService as any,
    );
  });

  describe("createHold", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.createHold("non-existent", "farm-1", "user-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should auto-capture and return fee waived if feeCents === 0", async () => {
      const consultation = createSampleConsultation({ feeCents: 0 });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.createHold("consult-1", "farm-1", "user-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(result.amountCents).toBe(0);
      expect(result.paymentIntentId).toBe("fee_waived_zero");
      expect(mockPaymentGateway.createAuthorizationHold).not.toHaveBeenCalled();
      expect(mockConsultationRepo.save).toHaveBeenCalled();
    });

    it("should return existing hold if already AUTHORIZED (idempotency)", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_existing_123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.createHold("consult-1", "farm-1", "user-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.AUTHORIZED);
      expect(result.paymentIntentId).toBe("pi_existing_123");
      expect(mockPaymentGateway.createAuthorizationHold).not.toHaveBeenCalled();
    });

    it("should throw if payment has already been CAPTURED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.CAPTURED,
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      await expect(
        service.createHold("consult-1", "farm-1", "user-1"),
      ).rejects.toThrow("Consultation payment has already been captured.");
    });

    it("should create authorization hold via gateway, update entity, and record audit log", async () => {
      const consultation = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.createHold("consult-1", "farm-1", "user-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.AUTHORIZED);
      expect(result.paymentIntentId).toBe("pi_hold_test_123");
      expect(result.clientSecret).toBe("secret_test_123");
      expect(mockPaymentGateway.createAuthorizationHold).toHaveBeenCalledWith(
        "consult-1",
        3000,
        "USD",
        "farmer@test.com",
        expect.objectContaining({ farmId: "farm-1" }),
      );
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_PAYMENT_HOLD_CREATED",
          entityId: "consult-1",
        }),
      );
    });
  });

  describe("confirmHold", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.confirmHold("consult-1", "pi_hold_test_123", "user-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if paymentIntentId does not match", async () => {
      const consultation = createSampleConsultation({
        paymentIntentId: "pi_other_intent",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      await expect(
        service.confirmHold("consult-1", "pi_mismatched_intent", "user-1"),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should confirm hold and transition status to AUTHORIZED", async () => {
      const consultation = createSampleConsultation({
        paymentIntentId: "pi_hold_test_123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.confirmHold(
        "consult-1",
        "pi_hold_test_123",
        "user-1",
      );

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.AUTHORIZED);
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_PAYMENT_HOLD_CONFIRMED",
        }),
      );
    });
  });

  describe("capturePayment", () => {
    it("should return early if already CAPTURED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.CAPTURED,
        paymentCapturedAt: new Date(),
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.capturePayment("consult-1", "vet-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(mockPaymentGateway.captureHold).not.toHaveBeenCalled();
    });

    it("should capture feeCents === 0 directly", async () => {
      const consultation = createSampleConsultation({
        feeCents: 0,
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.capturePayment("consult-1", "vet-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(result.amountCents).toBe(0);
      expect(mockPaymentGateway.captureHold).not.toHaveBeenCalled();
    });

    it("should throw if consultation is not in AUTHORIZED status", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.UNPAID,
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      await expect(
        service.capturePayment("consult-1", "vet-1"),
      ).rejects.toThrow("Must be in 'AUTHORIZED' status");
    });

    it("should capture hold via gateway and update status to CAPTURED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_hold_test_123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.capturePayment("consult-1", "vet-1");

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(mockPaymentGateway.captureHold).toHaveBeenCalledWith(
        "pi_hold_test_123",
        3000,
      );
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_PAYMENT_CAPTURED",
        }),
      );
    });

    it("should capture hold via gateway and trigger settlement when vet is assigned", async () => {
      const consultation = createSampleConsultation({
        vetId: "vet-1",
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_hold_test_123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.capturePayment(
        "consult-1",
        "vet-1",
        "trace-cap-1",
      );

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(mockPaymentGateway.captureHold).toHaveBeenCalledWith(
        "pi_hold_test_123",
        3000,
      );
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(
        mockVetPayoutLedgerService.recordConsultationSettlement,
      ).toHaveBeenCalledWith("consult-1", undefined, "trace-cap-1");
    });
  });

  describe("releaseHold", () => {
    it("should return early if already RELEASED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.RELEASED,
        paymentReleasedAt: new Date(),
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.releaseHold(
        "consult-1",
        "Already cancelled",
        "triage-1",
      );

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.RELEASED);
      expect(mockPaymentGateway.releaseHold).not.toHaveBeenCalled();
    });

    it("should throw if payment has already been CAPTURED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.CAPTURED,
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      await expect(
        service.releaseHold("consult-1", "Cancel", "triage-1"),
      ).rejects.toThrow("Cannot release payment that has already been captured.");
    });

    it("should release hold via gateway and update status to RELEASED", async () => {
      const consultation = createSampleConsultation({
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_hold_test_123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consultation);

      const result = await service.releaseHold(
        "consult-1",
        "No available vets",
        "triage-1",
      );

      expect(result.paymentStatus).toBe(ConsultationPaymentStatus.RELEASED);
      expect(mockPaymentGateway.releaseHold).toHaveBeenCalledWith(
        "pi_hold_test_123",
      );
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_PAYMENT_HOLD_RELEASED",
        }),
      );
    });
  });
});
