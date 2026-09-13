import {
  HealthIncidentResponseDto,
  PaginatedHealthIncidentsDto,
} from "@vetralink/shared-types";
import { CreateHealthIncidentDto } from "../dto/create-health-incident.dto";
import { UpdateHealthIncidentDto } from "../dto/update-health-incident.dto";
import { ResolveHealthIncidentDto } from "../dto/resolve-health-incident.dto";
import { HealthIncidentQueryDto } from "../dto/health-incident-query.dto";

export interface IClinicalHealthService {
  createIncident(
    farmId: string,
    actorUserId: string,
    dto: CreateHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto>;

  getIncidentById(
    id: string,
    farmId: string
  ): Promise<HealthIncidentResponseDto>;

  listIncidents(
    farmId: string,
    query: HealthIncidentQueryDto
  ): Promise<PaginatedHealthIncidentsDto>;

  updateIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto>;

  resolveIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: ResolveHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto>;

  deleteIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;
}

export const CLINICAL_HEALTH_SERVICE = "CLINICAL_HEALTH_SERVICE";
