import {
  ConsultationReviewDto,
  JwtPayload,
  ReviewModerationStatus,
  UserRole,
  UserStatus,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import { ConsultationReviewController } from "./consultation-review.controller";
import { IConsultationReviewService } from "../services/consultation-review.service.interface";

describe("ConsultationReviewController", () => {
  let controller: ConsultationReviewController;
  let mockReviewService: jest.Mocked<IConsultationReviewService>;

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

  const sampleReviewDto: ConsultationReviewDto = {
    id: "rev-101",
    consultationId: "consult-101",
    farmerId: "farmer-1",
    vetId: "vet-1",
    rating: 5,
    feedback: "Exceptional service and quick turnaround!",
    tags: ["QUICK_RESPONSE"],
    isPublic: true,
    moderationStatus: ReviewModerationStatus.APPROVED,
    moderatedById: null,
    moderatedAt: null,
    moderationReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleSummaryDto: VetRatingSummaryDto = {
    vetId: "vet-1",
    averageRating: 4.8,
    totalReviews: 10,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 8 },
    topTags: [{ tag: "QUICK_RESPONSE", count: 8 }],
  };

  beforeEach(() => {
    mockReviewService = {
      submitReview: jest.fn().mockResolvedValue(sampleReviewDto),
      getConsultationReview: jest.fn().mockResolvedValue(sampleReviewDto),
      getVetReviews: jest.fn().mockResolvedValue({
        items: [sampleReviewDto],
        total: 1,
      }),
      getModerationReviews: jest.fn().mockResolvedValue({
        items: [sampleReviewDto],
        total: 1,
      }),
      getVetRatingSummary: jest.fn().mockResolvedValue(sampleSummaryDto),
      moderateReview: jest.fn().mockResolvedValue({
        ...sampleReviewDto,
        moderationStatus: ReviewModerationStatus.REJECTED,
      }),
      updateVetProfileAggregates: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ConsultationReviewController(mockReviewService);
  });

  describe("submitReview", () => {
    it("should submit a review via review service", async () => {
      const dto = {
        rating: 5,
        feedback: "Exceptional service and quick turnaround!",
        tags: ["QUICK_RESPONSE"],
        isPublic: true,
      };

      const result = await controller.submitReview(
        "consult-101",
        farmerUser,
        dto,
      );

      expect(result).toEqual(sampleReviewDto);
      expect(mockReviewService.submitReview).toHaveBeenCalledWith(
        "consult-101",
        farmerUser,
        dto,
      );
    });
  });

  describe("getConsultationReview", () => {
    it("should return the consultation review", async () => {
      const result = await controller.getConsultationReview(
        "consult-101",
        farmerUser,
      );

      expect(result).toEqual(sampleReviewDto);
      expect(mockReviewService.getConsultationReview).toHaveBeenCalledWith(
        "consult-101",
        farmerUser,
      );
    });
  });

  describe("getVetReviews", () => {
    it("should retrieve reviews for a veterinarian", async () => {
      const result = await controller.getVetReviews("vet-1", { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(mockReviewService.getVetReviews).toHaveBeenCalledWith("vet-1", {
        page: 1,
        limit: 10,
      });
    });
  });

  describe("getVetRatingSummary", () => {
    it("should retrieve rating summary for a veterinarian", async () => {
      const result = await controller.getVetRatingSummary("vet-1");

      expect(result).toEqual(sampleSummaryDto);
      expect(mockReviewService.getVetRatingSummary).toHaveBeenCalledWith("vet-1");
    });
  });

  describe("getModerationReviews", () => {
    it("should retrieve reviews queue for moderation", async () => {
      const result = await controller.getModerationReviews({
        moderationStatus: ReviewModerationStatus.PENDING,
      });

      expect(result.items).toHaveLength(1);
      expect(mockReviewService.getModerationReviews).toHaveBeenCalledWith({
        moderationStatus: ReviewModerationStatus.PENDING,
      });
    });
  });

  describe("moderateReview", () => {
    it("should moderate a review via review service", async () => {
      const dto = {
        status: ReviewModerationStatus.REJECTED,
        reason: "Inappropriate content",
      };

      const result = await controller.moderateReview(
        "rev-101",
        adminUser,
        dto,
      );

      expect(result.moderationStatus).toBe(ReviewModerationStatus.REJECTED);
      expect(mockReviewService.moderateReview).toHaveBeenCalledWith(
        "rev-101",
        dto,
        adminUser,
      );
    });
  });
});
