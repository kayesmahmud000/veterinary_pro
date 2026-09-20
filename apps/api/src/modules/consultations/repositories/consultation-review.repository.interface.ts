import {
  ReviewQueryDto,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import { ConsultationReviewEntity } from "../entities/consultation-review.entity";

export interface IConsultationReviewRepository {
  create(entity: ConsultationReviewEntity): Promise<ConsultationReviewEntity>;
  save(entity: ConsultationReviewEntity): Promise<ConsultationReviewEntity>;
  findById(id: string): Promise<ConsultationReviewEntity | null>;
  findByConsultationId(
    consultationId: string,
  ): Promise<ConsultationReviewEntity | null>;
  findMany(
    query: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewEntity[]; total: number }>;
  findVetRatingSummary(vetId: string): Promise<VetRatingSummaryDto>;
}

export const CONSULTATION_REVIEW_REPOSITORY = "CONSULTATION_REVIEW_REPOSITORY";
