import { Prisma } from "@prisma/client";
import {
  ReviewQueryDto,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import { ConsultationReviewEntity } from "../entities/consultation-review.entity";

export interface IConsultationReviewRepository {
  lock(id: string, tx: Prisma.TransactionClient): Promise<void>;
  lockConsultation(id: string, tx: Prisma.TransactionClient): Promise<{farmerId:string;vetId:string|null;status:string}|null>;
  create(entity: ConsultationReviewEntity, tx?: Prisma.TransactionClient): Promise<ConsultationReviewEntity>;
  save(entity: ConsultationReviewEntity, tx?: Prisma.TransactionClient): Promise<ConsultationReviewEntity>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<ConsultationReviewEntity | null>;
  findByConsultationId(
    consultationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationReviewEntity | null>;
  findMany(
    query: ReviewQueryDto & {isPublic?: boolean},
  ): Promise<{ items: ConsultationReviewEntity[]; total: number }>;
  findVetRatingSummary(vetId: string): Promise<VetRatingSummaryDto>;
}

export const CONSULTATION_REVIEW_REPOSITORY = "CONSULTATION_REVIEW_REPOSITORY";
