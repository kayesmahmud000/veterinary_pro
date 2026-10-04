import {
  ConsultationReviewDto,
  JwtPayload,
  ModerateReviewDto,
  ReviewQueryDto,
  SubmitConsultationReviewDto,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";

export interface IConsultationReviewService {
  submitReview(
    consultationId: string,
    author: JwtPayload,
    dto: SubmitConsultationReviewDto,
    traceId?: string,
  ): Promise<ConsultationReviewDto>;

  getConsultationReview(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<ConsultationReviewDto | null>;

  getVetReviews(
    vetId: string,
    query?: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }>;

  getModerationReviews(
    query?: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }>;

  getVetRatingSummary(vetId: string): Promise<VetRatingSummaryDto>;

  moderateReview(
    reviewId: string,
    dto: ModerateReviewDto,
    actorUser: JwtPayload,
    traceId?: string,
  ): Promise<ConsultationReviewDto>;

  updateVetProfileAggregates(vetId: string): Promise<void>;
}

export const CONSULTATION_REVIEW_SERVICE = "CONSULTATION_REVIEW_SERVICE";
