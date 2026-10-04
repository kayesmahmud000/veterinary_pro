import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalSpecies,
  AnimalStatus,
  PaginatedVaccineRecordsDto,
  SpeciesVaccineProtocolDto,
  VaccineRecordResponseDto,
  VaccineScheduleSummaryDto,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../../animals/repositories/animal.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";
import {
  IVaccineRecordRepository,
  VACCINE_RECORD_REPOSITORY,
  VaccineRecordQueryFilter,
} from "../repositories/vaccine-record.repository.interface";
import { CreateVaccineRecordDto } from "../dto/create-vaccine-record.dto";
import { UpdateVaccineRecordDto } from "../dto/update-vaccine-record.dto";
import { VaccineRecordQueryDto } from "../dto/vaccine-record-query.dto";
import { VaccineScheduleQueryDto } from "../dto/vaccine-schedule-query.dto";
import { SPECIES_VACCINE_PROTOCOLS } from "../utils/species-vaccine-protocols.catalog";
import { IVaccineScheduleService } from "./vaccine-schedule.service.interface";

@Injectable()
export class VaccineScheduleService implements IVaccineScheduleService {
  private readonly logger = new Logger(VaccineScheduleService.name);

  constructor(
    @Inject(VACCINE_RECORD_REPOSITORY)
    private readonly vaccineRecordRepository: IVaccineRecordRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async recordAdministration(
    farmId: string,
    actorUserId: string,
    dto: CreateVaccineRecordDto,
    traceId?: string
  ): Promise<VaccineRecordResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. Validate animal exists in the farm
    const animal = await this.animalRepository.findById(dto.animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", dto.animalId);
    }

    if (
      [AnimalStatus.SOLD, AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(
        animal.status
      )
    ) {
      throw new ValidationDomainException(
        `Cannot administer preventative treatment on animal '${animal.tagNumber}' with status '${animal.status}'.`
      );
    }

    // 2. Instantiate domain entity
    const adminDate = new Date(dto.administeredAt);
    const dueDate = dto.nextDueDate ? new Date(dto.nextDueDate) : null;

    const entity = VaccineRecordEntity.create({
      farmId,
      animalId: dto.animalId,
      administeredById: actorUserId,
      recordType: dto.recordType,
      vaccineName: dto.vaccineName,
      batchNumber: dto.batchNumber,
      doseAmount: dto.doseAmount,
      doseUnit: dto.doseUnit,
      cost: dto.cost,
      notes: dto.notes,
      administeredAt: adminDate,
      nextDueDate: dueDate,
    });

    // 3. Persist in transaction with audit logging
    let savedEntity!: VaccineRecordEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.vaccineRecordRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "VACCINE_RECORD_CREATED",
          entityType: "VaccineRecord",
          entityId: savedEntity.id,
          newValues: savedEntity.toResponseDto() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Recorded ${savedEntity.recordType} '${savedEntity.vaccineName}' for animal '${animal.tagNumber}' [farm: ${farmId}]`
    );

    return savedEntity.toResponseDto();
  }

  public async getRecordById(
    id: string,
    farmId: string,
    asOfDate?: string
  ): Promise<VaccineRecordResponseDto> {
    const record = await this.vaccineRecordRepository.findById(id, farmId);
    if (!record) {
      throw new EntityNotFoundException("VaccineRecord", id);
    }

    return record.toResponseDto(asOfDate ? new Date(asOfDate) : undefined);
  }

  public async listRecords(
    farmId: string,
    query: VaccineRecordQueryDto
  ): Promise<PaginatedVaccineRecordsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const filter: VaccineRecordQueryFilter = {
      animalId: query.animalId,
      recordType: query.recordType,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      dueBefore: query.dueBefore ? new Date(query.dueBefore) : undefined,
      dueAfter: query.dueAfter ? new Date(query.dueAfter) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const { items, total } = await this.vaccineRecordRepository.findMany(
      farmId,
      filter
    );
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((record) => record.toResponseDto()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
    };
  }

  public async getScheduleSummary(
    farmId: string,
    query: VaccineScheduleQueryDto
  ): Promise<VaccineScheduleSummaryDto> {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    const daysAhead = query.daysAhead ?? 30;

    const [counts, upcoming] = await Promise.all([
      this.vaccineRecordRepository.getScheduleCounts(farmId, asOfDate),
      this.vaccineRecordRepository.findUpcoming(farmId, daysAhead, 10, asOfDate),
    ]);

    return {
      ...counts,
      upcomingEvents: upcoming.map((item) => item.toResponseDto(asOfDate)),
    };
  }

  public getSpeciesProtocols(
    species?: AnimalSpecies
  ): SpeciesVaccineProtocolDto[] {
    if (species) {
      const protocol = SPECIES_VACCINE_PROTOCOLS[species];
      return protocol ? [protocol] : [];
    }
    return Object.values(SPECIES_VACCINE_PROTOCOLS);
  }

  public async updateRecord(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateVaccineRecordDto,
    traceId?: string
  ): Promise<VaccineRecordResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.vaccineRecordRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("VaccineRecord", id);
    }

    if (
      dto.syncVersion !== undefined &&
      dto.syncVersion !== existing.syncVersion
    ) {
      throw new EntityConflictException(
        `Vaccine record has been modified by another process. Current version: ${existing.syncVersion}, received: ${dto.syncVersion}`,
        "syncVersion"
      );
    }

    const oldValues = existing.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    existing.update({
      recordType: dto.recordType,
      vaccineName: dto.vaccineName,
      batchNumber: dto.batchNumber,
      doseAmount: dto.doseAmount,
      doseUnit: dto.doseUnit,
      cost: dto.cost,
      notes: dto.notes,
      administeredAt: dto.administeredAt
        ? new Date(dto.administeredAt)
        : undefined,
      nextDueDate:
        dto.nextDueDate !== undefined
          ? dto.nextDueDate
            ? new Date(dto.nextDueDate)
            : null
          : undefined,
    });

    let savedEntity!: VaccineRecordEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.vaccineRecordRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "VACCINE_RECORD_UPDATED",
          entityType: "VaccineRecord",
          entityId: savedEntity.id,
          oldValues,
          newValues: savedEntity.toResponseDto() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Updated vaccine record ${id} [farm: ${farmId}, version: ${savedEntity.syncVersion}]`
    );

    return savedEntity.toResponseDto();
  }

  public async deleteRecord(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.vaccineRecordRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("VaccineRecord", id);
    }

    const oldValues = existing.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    await this.transactionManager.run(async (tx) => {
      await this.vaccineRecordRepository.delete(id, farmId, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "VACCINE_RECORD_DELETED",
          entityType: "VaccineRecord",
          entityId: id,
          oldValues,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(`Deleted vaccine record ${id} [farm: ${farmId}]`);
  }
}
