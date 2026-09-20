import { ReviewModerationStatus, ReviewRatingTag } from "../../enums/index.js";

export interface SubmitConsultationReviewDto {
  rating: number; // 1 to 5
  feedback?: string;
  tags?: (ReviewRatingTag | string)[];
  isPublic?: boolean;
}

export interface ConsultationReviewDto {
  id: string;
  consultationId: string;
  farmerId: string;
  vetId: string;
  rating: number;
  feedback?: string | null;
  tags: string[];
  isPublic: boolean;
  moderationStatus: ReviewModerationStatus;
  moderatedById?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  farmer?: {
    id: string;
    name: string;
  } | null;
  vet?: {
    id: string;
    name: string;
  } | null;
}

export interface VetRatingSummaryDto {
  vetId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  topTags: {
    tag: string;
    count: number;
  }[];
}

export interface ModerateReviewDto {
  status: ReviewModerationStatus;
  reason?: string;
}

export interface ReviewQueryDto {
  vetId?: string;
  farmerId?: string;
  moderationStatus?: ReviewModerationStatus;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
}
