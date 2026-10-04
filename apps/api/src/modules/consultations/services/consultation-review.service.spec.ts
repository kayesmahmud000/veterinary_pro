import {
  ConsultationStatus,
  JwtPayload,
  ReviewModerationStatus,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ConsultationEntity } from "../entities/consultation.entity";
import { ConsultationReviewEntity } from "../entities/consultation-review.entity";
import { IConsultationReviewRepository } from "../repositories/consultation-review.repository.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IVetProfileRepository } from "../repositories/vet-profile.repository.interface";
import { ConsultationReviewService } from "./consultation-review.service";

describe("ConsultationReviewService", () => {
  let service: ConsultationReviewService;
  let mockReviewRepo: jest.Mocked<IConsultationReviewRepository>;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockVetProfileRepo: jest.Mocked<IVetProfileRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;

  const farmerUser: JwtPayload = {
    sub: "farmer-1",
    email: "farmer@example.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const adminUser: JwtPayload = {
    sub: "admin-1",
    email: "admin@vetralink.com",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const otherUser: JwtPayload = {
    sub: "other-user",
    email: "other@example.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockConsultation = ConsultationEntity.fromPersistence({
    id: "consult-101",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow with fever and respiratory distress",
    mediaUrls: [],
    type: "LIVE_VIDEO" as any,
    status: ConsultationStatus.COMPLETED,
    roomSessionId: "room-101",
    feeCents: 5000,
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
    mockReviewRepo = {
      create: jest.fn().mockImplementation(async (e) => e),
      save: jest.fn().mockImplementation(async (e) => e),
      findById: jest.fn(),
      findByConsultationId: jest.fn(),
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findVetRatingSummary: jest.fn().mockResolvedValue({
        vetId: "vet-1",
        averageRating: 4.8,
        totalReviews: 12,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 10 },
        topTags: [{ tag: "QUICK_RESPONSE", count: 8 }],
      }),
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

    mockVetProfileRepo = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      findAllActiveVetsWithProfiles: jest.fn(),
      updateRatingAggregates: jest.fn().mockResolvedValue(undefined),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    service = new ConsultationReviewService(
      mockReviewRepo,
      mockConsultationRepo,
      mockVetProfileRepo,
      mockAuditLogRepo,
    );
  });

  describe("submitReview", () => {
    it("should successfully submit a review, update aggregates, and record audit log", async () => {
      mockConsultationRepo.findById.mockResolvedValue(mockConsultation);
      mockReviewRepo.findByConsultationId.mockResolvedValue(null);

      const result = await service.submitReview(
        "consult-101",
        farmerUser,
        {
          rating: 5,
          feedback: "Great guidance on treating mastitis.",
          tags: ["ACCURATE_DIAGNOSIS"],
          isPublic: true,
        },
        "trace-rev-1",
      );

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
      expect(result.consultationId).toBe("consult-101");
      expect(result.farmerId).toBe("farmer-1");
      expect(result.vetId).toBe("vet-1");
      expect(mockReviewRepo.create).toHaveBeenCalled();
      expect(mockVetProfileRepo.updateRatingAggregates).toHaveBeenCalledWith(
        "vet-1",
        4.8,
        12,
      );
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_REVIEW_SUBMITTED",
          userId: "farmer-1",
          traceId: "trace-rev-1",
        }),
      );
    });

    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.submitReview("non-existent", farmerUser, { rating: 5 }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if consultation is not completed", async () => {
      const pendingConsult = ConsultationEntity.fromPersistence({
        ...mockConsultation,
        status: ConsultationStatus.IN_PROGRESS,
      } as any);
      mockConsultationRepo.findById.mockResolvedValue(pendingConsult);

      await expect(
        service.submitReview("consult-101", farmerUser, { rating: 5 }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ForbiddenOperationException if user is not the farmer of the consultation", async () => {
      mockConsultationRepo.findById.mockResolvedValue(mockConsultation);

      await expect(
        service.submitReview("consult-101", otherUser, { rating: 5 }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if consultation has no assigned vet", async () => {
      const unassigned = ConsultationEntity.fromPersistence({
        ...mockConsultation,
        vetId: null,
      } as any);
      mockConsultationRepo.findById.mockResolvedValue(unassigned);

      await expect(
        service.submitReview("consult-101", farmerUser, { rating: 5 }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityConflictException if a review was already submitted", async () => {
      mockConsultationRepo.findById.mockResolvedValue(mockConsultation);
      const existing = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 4,
      });
      mockReviewRepo.findByConsultationId.mockResolvedValue(existing);

      await expect(
        service.submitReview("consult-101", farmerUser, { rating: 5 }),
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("getConsultationReview", () => {
    it("should return null if no review exists", async () => {
      mockReviewRepo.findByConsultationId.mockResolvedValue(null);

      const result = await service.getConsultationReview(
        "consult-101",
        farmerUser,
      );
      expect(result).toBeNull();
    });

    it("should return review DTO if review exists and is approved", async () => {
      const review = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 5,
      });
      mockReviewRepo.findByConsultationId.mockResolvedValue(review);

      const result = await service.getConsultationReview(
        "consult-101",
        farmerUser,
      );
      expect(result).toBeDefined();
      expect(result?.rating).toBe(5);
    });

    it("should hide rejected review from other users", async () => {
      const review = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 1,
      });
      review.reject("admin-1", "Spam");
      mockReviewRepo.findByConsultationId.mockResolvedValue(review);

      const result = await service.getConsultationReview(
        "consult-101",
        otherUser,
      );
      expect(result).toBeNull();
    });

    it("should show rejected review to admin and author farmer", async () => {
      const review = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 1,
      });
      review.reject("admin-1", "Spam");
      mockReviewRepo.findByConsultationId.mockResolvedValue(review);

      const farmerView = await service.getConsultationReview(
        "consult-101",
        farmerUser,
      );
      expect(farmerView).toBeDefined();

      const adminView = await service.getConsultationReview(
        "consult-101",
        adminUser,
      );
      expect(adminView).toBeDefined();
    });
  });

  describe("getVetReviews and getVetRatingSummary", () => {
    it("should query approved reviews for vet", async () => {
      const review = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 5,
      });
      mockReviewRepo.findMany.mockResolvedValue({
        items: [review],
        total: 1,
      });

      const result = await service.getVetReviews("vet-1");
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should fetch vet rating summary", async () => {
      const summary = await service.getVetRatingSummary("vet-1");
      expect(summary.averageRating).toBe(4.8);
      expect(summary.totalReviews).toBe(12);
    });
  });

  describe("moderateReview", () => {
    it("should throw EntityNotFoundException if review does not exist", async () => {
      mockReviewRepo.findById.mockResolvedValue(null);

      await expect(
        service.moderateReview(
          "non-existent",
          { status: ReviewModerationStatus.REJECTED, reason: "Spam" },
          adminUser,
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should update status to REJECTED, recalculate aggregates, and audit log", async () => {
      const review = ConsultationReviewEntity.create({
        consultationId: "consult-101",
        farmerId: "farmer-1",
        vetId: "vet-1",
        rating: 1,
      });
      mockReviewRepo.findById.mockResolvedValue(review);

      const result = await service.moderateReview(
        review.id,
        {
          status: ReviewModerationStatus.REJECTED,
          reason: "Inappropriate language",
        },
        adminUser,
        "trace-mod-1",
      );

      expect(result.moderationStatus).toBe(ReviewModerationStatus.REJECTED);
      expect(mockReviewRepo.save).toHaveBeenCalled();
      expect(mockVetProfileRepo.updateRatingAggregates).toHaveBeenCalledWith(
        "vet-1",
        4.8,
        12,
      );
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_REVIEW_MODERATED",
          userId: "admin-1",
          traceId: "trace-mod-1",
        }),
      );
    });
  });
});
