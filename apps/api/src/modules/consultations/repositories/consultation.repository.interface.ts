import { Prisma } from "@prisma/client";
import {
  QueryFarmerConsultationsDto,
  QueryTriageQueueDto,
  TriageCaseDetailDto,
  TriageMetricsDto,
} from "@vetralink/shared-types";
import { ConsultationEntity } from "../entities/consultation.entity";

export const CONSULTATION_REPOSITORY = Symbol("CONSULTATION_REPOSITORY");

export interface IConsultationRepository {
  findById(id: string, farmId?: string): Promise<ConsultationEntity | null>;
  create(
    entity: ConsultationEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationEntity>;
  save(
    entity: ConsultationEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationEntity>;
  findByFarm(
    farmId: string,
    query?: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }>;
  findByFarmer(
    farmerId: string,
    query?: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }>;
  findTriageQueue(
    query?: QueryTriageQueueDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }>;
  getTriageMetrics(now?: Date): Promise<TriageMetricsDto>;
  findTriageCaseDetail(id: string): Promise<TriageCaseDetailDto | null>;
  countActiveConsultationsByVet(vetId: string): Promise<number>;
  findConflictingConsultations(
    vetId: string,
    scheduledAt: Date,
    windowMinutes?: number,
  ): Promise<ConsultationEntity[]>;
}
