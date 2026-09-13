import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalStatus,
  HealthIncidentResponseDto,
  PaginatedHealthIncidentsDto,
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
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../../users/repositories/user.repository.interface";
import { HealthRecordEntity } from "../entities/health-record.entity";
import {
  HEALTH_RECORD_REPOSITORY,
  HealthRecordQueryFilter,
  IHealthRecordRepository,
} from "../repositories/health-record.repository.interface";
import { CreateHealthIncidentDto } from "../dto/create-health-incident.dto";
import { UpdateHealthIncidentDto } from "../dto/update-health-incident.dto";
import { ResolveHealthIncidentDto } from "../dto/resolve-health-incident.dto";
import { HealthIncidentQueryDto } from "../dto/health-incident-query.dto";
import { IClinicalHealthService } from "./clinical-health.service.interface";

@Injectable()
export class ClinicalHealthService implements IClinicalHealthService {
  private readonly logger = new Logger(ClinicalHealthService.name);

  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly healthRecordRepository: IHealthRecordRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async createIncident(
    farmId: string,
    actorUserId: string,
    dto: CreateHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. Verify Animal exists and belongs to the farm
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
        `Cannot log health incident on animal '${animal.tagNumber}' with status '${animal.status}'.`
      );
    }

    // 2. If attending vet provided, verify user exists
    if (dto.attendingVetId) {
      const vet = await this.userRepository.findById(dto.attendingVetId);
      if (!vet) {
        throw new EntityNotFoundException("AttendingVet", dto.attendingVetId);
      }
    }

    // 3. Instantiate Domain Entity
    const entity = HealthRecordEntity.create({
      farmId,
      animalId: dto.animalId,
      recordedById: actorUserId,
      attendingVetId: dto.attendingVetId,
      eventType: dto.eventType,
      severity: dto.severity,
      symptoms: dto.symptoms,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      cost: dto.cost,
      resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
    });

    // 4. Persist in ACID Transaction with Audit Logging
    let savedEntity!: HealthRecordEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.healthRecordRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "HEALTH_RECORD_CREATED",
          entityType: "HealthRecord",
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
      `Logged ${dto.eventType} incident (${dto.severity ?? "LOW"}) for animal '${animal.tagNumber}' [farm: ${farmId}]`
    );

    return savedEntity.toResponseDto();
  }

  public async getIncidentById(
    id: string,
    farmId: string
  ): Promise<HealthIncidentResponseDto> {
    const record = await this.healthRecordRepository.findById(id, farmId);
    if (!record) {
      throw new EntityNotFoundException("HealthRecord", id);
    }

    return record.toResponseDto();
  }

  public async listIncidents(
    farmId: string,
    query: HealthIncidentQueryDto
  ): Promise<PaginatedHealthIncidentsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const filter: HealthRecordQueryFilter = {
      animalId: query.animalId,
      eventType: query.eventType,
      severity: query.severity,
      isResolved: query.isResolved,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const { items, total } = await this.healthRecordRepository.findMany(
      farmId,
      filter
    );
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((record) => record.toResponseDto()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async updateIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.healthRecordRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("HealthRecord", id);
    }

    if (
      dto.syncVersion !== undefined &&
      dto.syncVersion !== existing.syncVersion
    ) {
      throw new EntityConflictException(
        `Health record has been modified by another process. Current version: ${existing.syncVersion}, received: ${dto.syncVersion}`,
        "syncVersion"
      );
    }

    if (dto.attendingVetId) {
      const vet = await this.userRepository.findById(dto.attendingVetId);
      if (!vet) {
        throw new EntityNotFoundException("AttendingVet", dto.attendingVetId);
      }
    }

    const oldValues = existing.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    existing.update({
      eventType: dto.eventType,
      severity: dto.severity,
      symptoms: dto.symptoms,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      cost: dto.cost,
      attendingVetId: dto.attendingVetId,
      resolvedAt:
        dto.resolvedAt !== undefined
          ? dto.resolvedAt
            ? new Date(dto.resolvedAt)
            : null
          : undefined,
    });

    let savedEntity!: HealthRecordEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.healthRecordRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "HEALTH_RECORD_UPDATED",
          entityType: "HealthRecord",
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
      `Updated clinical health incident ${id} [farm: ${farmId}, version: ${savedEntity.syncVersion}]`
    );

    return savedEntity.toResponseDto();
  }

  public async resolveIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: ResolveHealthIncidentDto,
    traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.healthRecordRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("HealthRecord", id);
    }

    if (
      dto.syncVersion !== undefined &&
      dto.syncVersion !== existing.syncVersion
    ) {
      throw new EntityConflictException(
        `Health record has been modified by another process. Current version: ${existing.syncVersion}, received: ${dto.syncVersion}`,
        "syncVersion"
      );
    }

    const oldValues = existing.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    existing.resolve({
      resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : new Date(),
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      cost: dto.cost,
    });

    let savedEntity!: HealthRecordEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.healthRecordRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "HEALTH_RECORD_RESOLVED",
          entityType: "HealthRecord",
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
      `Resolved clinical health incident ${id} on ${savedEntity.resolvedAt?.toISOString()} [farm: ${farmId}]`
    );

    return savedEntity.toResponseDto();
  }

  public async deleteIncident(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.healthRecordRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("HealthRecord", id);
    }

    const oldValues = existing.toResponseDto() as unknown as Record<
      string,
      unknown
    >;

    await this.transactionManager.run(async (tx) => {
      await this.healthRecordRepository.delete(id, farmId, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "HEALTH_RECORD_DELETED",
          entityType: "HealthRecord",
          entityId: id,
          oldValues,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(`Deleted health record ${id} [farm: ${farmId}]`);
  }
}
