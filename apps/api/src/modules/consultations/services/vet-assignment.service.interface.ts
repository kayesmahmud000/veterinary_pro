import {
  AssignConsultationDto,
  AutoAssignConsultationDto,
  ConsultationResponseDto,
  UpdateVetProfileDto,
  UserRole,
  VetAvailabilitySummaryDto,
  VetCandidateDto,
  VetProfileDto,
} from "@vetralink/shared-types";

export const VET_ASSIGNMENT_SERVICE = Symbol("VET_ASSIGNMENT_SERVICE");

export interface IVetAssignmentService {
  getRankedCandidates(consultationId: string): Promise<VetCandidateDto[]>;

  assignToVet(
    consultationId: string,
    dto: AssignConsultationDto,
    assignedByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto>;

  autoAssign(
    consultationId: string,
    dto: AutoAssignConsultationDto,
    assignedByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto>;

  getVetAvailabilityList(): Promise<VetAvailabilitySummaryDto[]>;

  getVetProfile(vetId: string): Promise<VetProfileDto>;

  updateVetProfile(
    vetId: string,
    dto: UpdateVetProfileDto,
    requestingUserId: string,
    requestingRole: UserRole,
    traceId?: string,
  ): Promise<VetProfileDto>;
}
