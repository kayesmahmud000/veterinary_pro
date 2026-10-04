import {
  ConsultationResponseDto,
  CreateConsultationRequestDto,
  QueryFarmerConsultationsDto,
  QueryTriageQueueDto,
  TriageCaseDetailDto,
  TriageMetricsDto,
  TriageQueueItemDto,
  UserRole,
} from "@vetralink/shared-types";

export const CONSULTATION_SERVICE = Symbol("CONSULTATION_SERVICE");

export interface IConsultationService {
  createConsultation(
    farmerId: string,
    dto: CreateConsultationRequestDto,
    traceId?: string,
  ): Promise<ConsultationResponseDto>;

  getConsultationById(
    id: string,
    farmId: string,
    userId: string,
    userRole?: UserRole,
  ): Promise<ConsultationResponseDto>;

  getFarmerConsultations(
    farmerId: string,
    farmId: string,
    query: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationResponseDto[]; total: number }>;

  getTriageQueue(
    query?: QueryTriageQueueDto,
  ): Promise<{
    items: TriageQueueItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  getTriageMetrics(now?: Date): Promise<TriageMetricsDto>;

  getTriageCaseDetail(id: string): Promise<TriageCaseDetailDto>;

  cancelTriageCase(
    id: string,
    reason: string,
    cancelledByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto>;
}
