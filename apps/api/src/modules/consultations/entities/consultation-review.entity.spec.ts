import { ReviewModerationStatus } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { ConsultationReviewEntity } from "./consultation-review.entity";

describe("ConsultationReviewEntity", () => {
  const validProps = {
    consultationId: "consult-1",
    farmerId: "farmer-1",
    vetId: "vet-1",
    rating: 5,
    feedback: "Exceptional diagnosis and prompt response!",
    tags: ["ACCURATE_DIAGNOSIS", "QUICK_RESPONSE"],
    isPublic: true,
  };

  it("should create a valid ConsultationReviewEntity with default APPROVED moderation status", () => {
    const review = ConsultationReviewEntity.create(validProps);

    expect(review.id).toBeDefined();
    expect(review.consultationId).toBe("consult-1");
    expect(review.farmerId).toBe("farmer-1");
    expect(review.vetId).toBe("vet-1");
    expect(review.rating).toBe(5);
    expect(review.feedback).toBe("Exceptional diagnosis and prompt response!");
    expect(review.tags).toEqual(["ACCURATE_DIAGNOSIS", "QUICK_RESPONSE"]);
    expect(review.isPublic).toBe(true);
    expect(review.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
    expect(review.createdAt).toBeInstanceOf(Date);
    expect(review.updatedAt).toBeInstanceOf(Date);
  });

  it("should throw ValidationDomainException if consultationId is empty", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        consultationId: "",
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if farmerId is empty", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        farmerId: "  ",
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if vetId is empty", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        vetId: "",
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if rating is less than 1 or greater than 5", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        rating: 0,
      }),
    ).toThrow(ValidationDomainException);

    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        rating: 6,
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if rating is not an integer", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        rating: 4.5,
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if feedback exceeds 1000 characters", () => {
    expect(() =>
      ConsultationReviewEntity.create({
        ...validProps,
        feedback: "a".repeat(1001),
      }),
    ).toThrow(ValidationDomainException);
  });

  it("should correctly transition status on approve, flag, and reject", () => {
    const review = ConsultationReviewEntity.create(validProps);

    review.flag("admin-1", "Suspicious spam pattern");
    expect(review.moderationStatus).toBe(ReviewModerationStatus.FLAGGED);
    expect(review.moderatedById).toBe("admin-1");
    expect(review.moderationReason).toBe("Suspicious spam pattern");
    expect(review.moderatedAt).toBeInstanceOf(Date);

    review.reject("admin-1", "Violates terms of service");
    expect(review.moderationStatus).toBe(ReviewModerationStatus.REJECTED);
    expect(review.moderationReason).toBe("Violates terms of service");

    review.approve("admin-2", "Verified authentic review");
    expect(review.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
    expect(review.moderatedById).toBe("admin-2");
    expect(review.moderationReason).toBe("Verified authentic review");
  });

  it("should serialize to DTO properly", () => {
    const review = ConsultationReviewEntity.create(validProps);
    const dto = review.toDto();

    expect(dto.id).toBe(review.id);
    expect(dto.consultationId).toBe("consult-1");
    expect(dto.farmerId).toBe("farmer-1");
    expect(dto.vetId).toBe("vet-1");
    expect(dto.rating).toBe(5);
    expect(dto.feedback).toBe(validProps.feedback);
    expect(dto.tags).toEqual(validProps.tags);
    expect(dto.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
    expect(typeof dto.createdAt).toBe("string");
  });
});
