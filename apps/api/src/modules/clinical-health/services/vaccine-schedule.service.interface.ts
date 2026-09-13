import {
  AnimalSpecies,
  PaginatedVaccineRecordsDto,
  SpeciesVaccineProtocolDto,
  VaccineRecordResponseDto,
  VaccineScheduleSummaryDto,
} from "@vetralink/shared-types";
import { CreateVaccineRecordDto } from "../dto/create-vaccine-record.dto";
import { UpdateVaccineRecordDto } from "../dto/update-vaccine-record.dto";
import { VaccineRecordQueryDto } from "../dto/vaccine-record-query.dto";
import { VaccineScheduleQueryDto } from "../dto/vaccine-schedule-query.dto";

export interface IVaccineScheduleService {
  recordAdministration(
    farmId: string,
    actorUserId: string,
    dto: CreateVaccineRecordDto,
    traceId?: string
  ): Promise<VaccineRecordResponseDto>;

  getRecordById(
    id: string,
    farmId: string,
    asOfDate?: string
  ): Promise<VaccineRecordResponseDto>;

  listRecords(
    farmId: string,
    query: VaccineRecordQueryDto
  ): Promise<PaginatedVaccineRecordsDto>;

  getScheduleSummary(
    farmId: string,
    query: VaccineScheduleQueryDto
  ): Promise<VaccineScheduleSummaryDto>;

  getSpeciesProtocols(
    species?: AnimalSpecies
  ): SpeciesVaccineProtocolDto[];

  updateRecord(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateVaccineRecordDto,
    traceId?: string
  ): Promise<VaccineRecordResponseDto>;

  deleteRecord(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;
}

export const VACCINE_SCHEDULE_SERVICE = "VACCINE_SCHEDULE_SERVICE";
