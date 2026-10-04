import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { ConsultationEntity } from "./consultation.entity";

describe("ConsultationEntity", () => {
  const validProps = {
    farmerId: "farmer-123",
    farmId: "farm-123",
    animalId: "animal-123",
    chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
    mediaUrls: ["https://s3.amazonaws.com/vetralink-media/lesion1.jpg"],
    type: ConsultationType.LIVE_VIDEO,
    feeCents: 2500,
  };

  describe("create()", () => {
    it("should successfully create a consultation entity in SUBMITTED status", () => {
      const entity = ConsultationEntity.create(validProps);

      expect(entity.id).toBeDefined();
      expect(entity.farmerId).toBe(validProps.farmerId);
      expect(entity.farmId).toBe(validProps.farmId);
      expect(entity.animalId).toBe(validProps.animalId);
      expect(entity.chiefComplaint).toBe(validProps.chiefComplaint);
      expect(entity.mediaUrls).toEqual(validProps.mediaUrls);
      expect(entity.type).toBe(ConsultationType.LIVE_VIDEO);
      expect(entity.status).toBe(ConsultationStatus.SUBMITTED);
      expect(entity.feeCents).toBe(2500);
      expect(entity.vetId).toBeNull();
      expect(entity.roomSessionId).toBeNull();
      expect(entity.isSubmitted()).toBe(true);
    });

    it("should default to ASYNC_TICKET and fee 0 when optional props omitted", () => {
      const entity = ConsultationEntity.create({
        farmerId: "farmer-123",
        farmId: "farm-123",
        chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
      });

      expect(entity.type).toBe(ConsultationType.ASYNC_TICKET);
      expect(entity.feeCents).toBe(0);
      expect(entity.animalId).toBeNull();
      expect(entity.mediaUrls).toEqual([]);
    });

    it("should throw ValidationDomainException if farmerId is missing", () => {
      expect(() =>
        ConsultationEntity.create({
          ...validProps,
          farmerId: "",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if farmId is missing", () => {
      expect(() =>
        ConsultationEntity.create({
          ...validProps,
          farmId: "",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if chiefComplaint is shorter than 10 characters", () => {
      expect(() =>
        ConsultationEntity.create({
          ...validProps,
          chiefComplaint: "Sick cow",
        }),
      ).toThrow("Chief complaint must be at least 10 characters long");
    });
  });

  describe("assignToVet()", () => {
    it("should assign veterinarian and update status to ASSIGNED", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");

      expect(entity.vetId).toBe("vet-456");
      expect(entity.status).toBe(ConsultationStatus.ASSIGNED);
      expect(entity.isAssigned()).toBe(true);
    });

    it("should throw if vetId is empty", () => {
      const entity = ConsultationEntity.create(validProps);
      expect(() => entity.assignToVet("")).toThrow(ValidationDomainException);
    });

    it("should throw if consultation is already completed", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");
      entity.startConsultation();
      entity.complete();

      expect(() => entity.assignToVet("vet-789")).toThrow(
        "Cannot assign consultation in status 'COMPLETED'",
      );
    });
  });

  describe("startConsultation()", () => {
    it("should transition status to IN_PROGRESS and record roomSessionId", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");
      entity.startConsultation("room-session-abc");

      expect(entity.status).toBe(ConsultationStatus.IN_PROGRESS);
      expect(entity.roomSessionId).toBe("room-session-abc");
      expect(entity.isInProgress()).toBe(true);
    });

    it("should throw if consultation is completed or cancelled", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.cancel();

      expect(() => entity.startConsultation()).toThrow(
        "Cannot start consultation in status 'CANCELLED'",
      );
    });
  });

  describe("complete()", () => {
    it("should transition status to COMPLETED", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");
      entity.startConsultation();
      entity.complete();

      expect(entity.status).toBe(ConsultationStatus.COMPLETED);
      expect(entity.isCompleted()).toBe(true);
    });

    it("should throw if consultation is in SUBMITTED status without being assigned/started", () => {
      const entity = ConsultationEntity.create(validProps);

      expect(() => entity.complete()).toThrow(
        "Cannot complete consultation in status 'SUBMITTED'",
      );
    });
  });

  describe("cancel()", () => {
    it("should cancel a submitted or assigned consultation", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.cancel();

      expect(entity.status).toBe(ConsultationStatus.CANCELLED);
      expect(entity.isCancelled()).toBe(true);
    });

    it("should throw if trying to cancel a COMPLETED consultation", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");
      entity.startConsultation();
      entity.complete();

      expect(() => entity.cancel()).toThrow(
        "Cannot cancel consultation in status 'COMPLETED'",
      );
    });
  });

  describe("Payment State Transitions", () => {
    it("should place payment hold successfully", () => {
      const entity = ConsultationEntity.create(validProps);
      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.UNPAID);
      expect(entity.isPaymentAuthorized()).toBe(false);

      entity.placePaymentHold("pi_12345");
      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.AUTHORIZED);
      expect(entity.paymentIntentId).toBe("pi_12345");
      expect(entity.paymentHeldAt).toBeInstanceOf(Date);
      expect(entity.isPaymentAuthorized()).toBe(true);
    });

    it("should throw if placing payment hold on already captured consultation", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.placePaymentHold("pi_12345");
      entity.capturePayment();

      expect(() => entity.placePaymentHold("pi_67890")).toThrow(
        "Cannot place payment hold on consultation in status 'CAPTURED'",
      );
    });

    it("should capture payment successfully", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.placePaymentHold("pi_12345");
      entity.capturePayment();

      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(entity.paymentCapturedAt).toBeInstanceOf(Date);
    });

    it("should allow capturing feeCents=0 consultation directly from UNPAID", () => {
      const entity = ConsultationEntity.create({
        ...validProps,
        feeCents: 0,
      });
      entity.capturePayment();
      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
    });

    it("should release payment hold successfully", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.placePaymentHold("pi_12345");
      entity.releasePaymentHold();

      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.RELEASED);
      expect(entity.paymentReleasedAt).toBeInstanceOf(Date);
    });

    it("should throw if releasing payment that was already captured", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.placePaymentHold("pi_12345");
      entity.capturePayment();

      expect(() => entity.releasePaymentHold()).toThrow(
        "Cannot release payment in status 'CAPTURED'",
      );
    });

    it("should mark payment failed successfully", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.markPaymentFailed();

      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.FAILED);
    });

    it("should auto-capture payment when completing consultation if AUTHORIZED", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.assignToVet("vet-456");
      entity.placePaymentHold("pi_12345");
      entity.startConsultation();
      entity.complete();

      expect(entity.status).toBe(ConsultationStatus.COMPLETED);
      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.CAPTURED);
      expect(entity.paymentCapturedAt).toBeInstanceOf(Date);
    });

    it("should auto-release payment when cancelling consultation if AUTHORIZED", () => {
      const entity = ConsultationEntity.create(validProps);
      entity.placePaymentHold("pi_12345");
      entity.cancel();

      expect(entity.status).toBe(ConsultationStatus.CANCELLED);
      expect(entity.paymentStatus).toBe(ConsultationPaymentStatus.RELEASED);
      expect(entity.paymentReleasedAt).toBeInstanceOf(Date);
    });
  });

  describe("fromPersistence() and toResponseDto()", () => {
    it("should map to and from persistence correctly with payment fields", () => {
      const dbRecord = {
        id: "consult-123",
        farmerId: "farmer-1",
        vetId: "vet-1",
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Cow has severe mastitis and reduced milk output.",
        mediaUrls: ["https://s3.amazonaws.com/image.jpg"],
        type: ConsultationType.ASYNC_TICKET,
        status: ConsultationStatus.ASSIGNED,
        roomSessionId: null,
        feeCents: 1500,
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_test_123",
        paymentHeldAt: new Date("2026-09-20T10:05:00Z"),
        paymentCapturedAt: null,
        paymentReleasedAt: null,
        currency: "USD",
        createdAt: new Date("2026-09-20T10:00:00Z"),
        updatedAt: new Date("2026-09-20T11:00:00Z"),
        farmer: { id: "farmer-1", name: "John Doe", email: "john@farm.com" },
        vet: { id: "vet-1", name: "Dr. Smith", email: "smith@vet.com" },
        animal: {
          id: "animal-1",
          name: "Daisy",
          tagNumber: "COW-001",
          species: "COW",
        },
        farm: { id: "farm-1", name: "Green Pastures" },
      };

      const entity = ConsultationEntity.fromPersistence(dbRecord);
      const dto = entity.toResponseDto();

      expect(dto.id).toBe("consult-123");
      expect(dto.farmer?.name).toBe("John Doe");
      expect(dto.vet?.name).toBe("Dr. Smith");
      expect(dto.animal?.tagNumber).toBe("COW-001");
      expect(dto.farm?.name).toBe("Green Pastures");
      expect(dto.feeCents).toBe(1500);
      expect(dto.paymentStatus).toBe(ConsultationPaymentStatus.AUTHORIZED);
      expect(dto.paymentIntentId).toBe("pi_test_123");
      expect(dto.currency).toBe("USD");
      expect(dto.paymentHeldAt).toBe("2026-09-20T10:05:00.000Z");
    });
  });
});
