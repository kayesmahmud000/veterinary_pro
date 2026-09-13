import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnimalGender,
  AnimalStatus,
  CreateBulkMilkLogRequestDto,
  CreateMilkLogRequestDto,
  MilkLogQueryRequestDto,
  MilkLogResponseDto,
  MilkYieldAnalyticsQueryDto,
  MilkYieldAnalyticsResponseDto,
  PaginatedMilkLogsDto,
  UpdateMilkLogRequestDto,
} from "@vetralink/shared-types";
import {
  MilkYieldAnalyticsCalculator,
  addDays,
  formatDateToYmd,
  parseYmdToDate,
} from "../utils/milk-yield-analytics.util";
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
import { MilkLogEntity } from "../entities/milk-log.entity";
import {
  IMilkLogRepository,
  MILK_LOG_REPOSITORY,
} from "../repositories/milk-log.repository.interface";
import {
  IMilkAnomalyQueueService,
  MILK_ANOMALY_QUEUE_SERVICE,
} from "./milk-anomaly-queue.service.interface";
import { IMilkLogService } from "./milk-log.service.interface";

@Injectable()
export class MilkLogService implements IMilkLogService {
  private readonly logger = new Logger(MilkLogService.name);

  constructor(
    @Inject(MILK_LOG_REPOSITORY)
    private readonly milkLogRepository: IMilkLogRepository,
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(MILK_ANOMALY_QUEUE_SERVICE)
    private readonly anomalyQueueService: IMilkAnomalyQueueService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async createMilkLog(
    farmId: string,
    actorUserId: string,
    dto: CreateMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. Biological & Physiological Animal Validation
    const animal = await this.animalRepository.findById(dto.animalId, farmId);
    if (!animal) {
      throw new EntityNotFoundException("Animal", dto.animalId);
    }

    if (animal.gender !== AnimalGender.FEMALE) {
      throw new ValidationDomainException(
        `Cannot log milk yield: animal '${animal.tagNumber}' is biologically ${animal.gender} (only FEMALE animals produce milk).`
      );
    }

    if (!animal.canProduceMilk()) {
      throw new ValidationDomainException(
        `Cannot log milk yield: animal species '${animal.species}' is not a recognized dairy/milking species.`
      );
    }

    if (
      [AnimalStatus.SOLD, AnimalStatus.DECEASED, AnimalStatus.CULLED].includes(
        animal.status
      )
    ) {
      throw new ValidationDomainException(
        `Cannot log milk yield for animal '${animal.tagNumber}' with status '${animal.status}'.`
      );
    }

    // 2. Date Validation (Must not be in the future)
    const parsedDate = new Date(dto.loggedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationDomainException("Invalid loggedDate format. Must be YYYY-MM-DD.");
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsedDate > today) {
      throw new ValidationDomainException("Milking session date cannot be in the future.");
    }

    // 3. Duplicate Session Conflict Check
    const existing = await this.milkLogRepository.findBySessionAndDate(
      farmId,
      dto.animalId,
      parsedDate,
      dto.session
    );
    if (existing) {
      throw new EntityConflictException(
        `A milk log for animal '${animal.tagNumber}' on ${dto.loggedDate} during session '${dto.session}' already exists. Use PATCH to update.`
      );
    }

    // 4. Instantiate Domain Entity
    const entity = MilkLogEntity.create({
      farmId,
      animalId: dto.animalId,
      recordedById: actorUserId,
      session: dto.session,
      yieldLiters: dto.yieldLiters,
      fatPercent: dto.fatPercent,
      snfPercent: dto.snfPercent,
      loggedDate: parsedDate,
    });

    // 5. Persist inside ACID Transaction with Audit Trail
    let savedEntity!: MilkLogEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.milkLogRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "MILK_LOG_RECORDED",
          entityType: "MilkLog",
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
      `Recorded ${dto.yieldLiters}L milk yield for animal '${animal.tagNumber}' (${dto.session}) on ${dto.loggedDate} [farm: ${farmId}]`
    );

    // 6. Asynchronously trigger anomaly detection check
    await this.anomalyQueueService
      .dispatchAnimalDropCheck(
        farmId,
        dto.animalId,
        dto.loggedDate,
        activeTraceId
      )
      .catch((err) =>
        this.logger.warn(
          `Failed to dispatch anomaly drop check for animal [${dto.animalId}]: ${(err as Error).message}`
        )
      );

    return savedEntity.toResponseDto();
  }

  public async createBulkMilkLog(
    farmId: string,
    actorUserId: string,
    dto: CreateBulkMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. Validate yield volume for bulk herd collection
    if (dto.yieldLiters <= 0) {
      throw new ValidationDomainException("Bulk milk yield must be greater than 0 liters.");
    }
    if (dto.yieldLiters > 100000) {
      throw new ValidationDomainException("Bulk milk yield cannot exceed 100,000 liters in a single session.");
    }

    // 2. Validate Date (Must not be in the future)
    const parsedDate = new Date(dto.loggedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationDomainException("Invalid loggedDate format. Must be YYYY-MM-DD.");
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsedDate > today) {
      throw new ValidationDomainException("Milking session date cannot be in the future.");
    }

    // 3. Duplicate Bulk Session Conflict Check
    const existing = await this.milkLogRepository.findBulkBySessionAndDate(
      farmId,
      parsedDate,
      dto.session
    );
    if (existing) {
      throw new EntityConflictException(
        `A bulk herd milk log for this farm on ${dto.loggedDate} during session '${dto.session}' already exists. Use PATCH to update.`
      );
    }

    // 4. Validate cold chain temperature if provided (-5°C to 45°C)
    if (
      dto.tankTemperatureCelsius !== undefined &&
      dto.tankTemperatureCelsius !== null &&
      (dto.tankTemperatureCelsius < -5 || dto.tankTemperatureCelsius > 45)
    ) {
      throw new ValidationDomainException("Tank temperature must be between -5.0°C and 45.0°C.");
    }

    // 5. Instantiate Domain Entity (animalId is null)
    const entity = MilkLogEntity.create({
      farmId,
      animalId: null,
      recordedById: actorUserId,
      session: dto.session,
      yieldLiters: dto.yieldLiters,
      fatPercent: dto.fatPercent,
      snfPercent: dto.snfPercent,
      loggedDate: parsedDate,
    });

    // 6. Persist inside ACID Transaction with Audit Trail
    let savedEntity!: MilkLogEntity;
    await this.transactionManager.run(async (tx) => {
      savedEntity = await this.milkLogRepository.create(entity, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "BULK_MILK_LOG_RECORDED",
          entityType: "MilkLog",
          entityId: savedEntity.id,
          newValues: {
            ...savedEntity.toResponseDto(),
            milkingAnimalsCount: dto.milkingAnimalsCount,
            tankTemperatureCelsius: dto.tankTemperatureCelsius,
            notes: dto.notes,
          } as unknown as Record<string, unknown>,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(
      `Recorded ${dto.yieldLiters}L bulk milk collection (${dto.session}) on ${dto.loggedDate} [farm: ${farmId}]`
    );

    return savedEntity.toResponseDto();
  }

  public async updateMilkLog(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.milkLogRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("MilkLog", id);
    }

    const oldValues = existing.toResponseDto();

    let newDate: Date | undefined;
    if (dto.loggedDate) {
      newDate = new Date(dto.loggedDate);
      if (isNaN(newDate.getTime())) {
        throw new ValidationDomainException("Invalid loggedDate format. Must be YYYY-MM-DD.");
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (newDate > today) {
        throw new ValidationDomainException("Milking session date cannot be in the future.");
      }
    }

    // If date or session changed, verify duplicate constraint
    const targetDate = newDate ?? existing.loggedDate;
    const targetSession = dto.session ?? existing.session;

    if (
      (dto.session && dto.session !== existing.session) ||
      (newDate && newDate.getTime() !== existing.loggedDate.getTime())
    ) {
      if (existing.animalId) {
        const duplicate = await this.milkLogRepository.findBySessionAndDate(
          farmId,
          existing.animalId,
          targetDate,
          targetSession
        );
        if (duplicate && duplicate.id !== id) {
          throw new EntityConflictException(
            `A milk log for this animal on ${targetDate.toISOString().split("T")[0]} during session '${targetSession}' already exists.`
          );
        }
      }
    }

    // Update entity
    existing.update({
      yieldLiters: dto.yieldLiters,
      fatPercent: dto.fatPercent,
      snfPercent: dto.snfPercent,
      session: dto.session,
      loggedDate: newDate,
    });

    let updatedEntity!: MilkLogEntity;
    await this.transactionManager.run(async (tx) => {
      updatedEntity = await this.milkLogRepository.update(existing, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "MILK_LOG_UPDATED",
          entityType: "MilkLog",
          entityId: id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: updatedEntity.toResponseDto() as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    return updatedEntity.toResponseDto();
  }

  public async deleteMilkLog(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    const existing = await this.milkLogRepository.findById(id, farmId);
    if (!existing) {
      throw new EntityNotFoundException("MilkLog", id);
    }

    const oldValues = existing.toResponseDto();

    await this.transactionManager.run(async (tx) => {
      await this.milkLogRepository.delete(id, farmId, tx);

      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "MILK_LOG_DELETED",
          entityType: "MilkLog",
          entityId: id,
          oldValues: oldValues as unknown as Record<string, unknown>,
          traceId: activeTraceId,
        },
        tx
      );
    });
  }

  public async getMilkLogById(
    id: string,
    farmId: string
  ): Promise<MilkLogResponseDto> {
    const log = await this.milkLogRepository.findById(id, farmId);
    if (!log) {
      throw new EntityNotFoundException("MilkLog", id);
    }
    return log.toResponseDto();
  }

  public async queryMilkLogs(
    farmId: string,
    query: MilkLogQueryRequestDto
  ): Promise<PaginatedMilkLogsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const { items, total } = await this.milkLogRepository.findMany(farmId, {
      animalId: query.animalId,
      session: query.session,
      startDate,
      endDate,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      entryType: query.entryType,
    });

    return {
      items: items.map((item) => item.toResponseDto()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getYieldAnalytics(
    farmId: string,
    query: MilkYieldAnalyticsQueryDto
  ): Promise<MilkYieldAnalyticsResponseDto> {
    // 1. If animalId provided, verify it exists within this farm
    if (query.animalId) {
      const animal = await this.animalRepository.findById(
        query.animalId,
        farmId
      );
      if (!animal) {
        throw new EntityNotFoundException("Animal", query.animalId);
      }
    }

    // 2. Parse and normalize date range (default to trailing 30 days)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let parsedEndDate: Date;
    if (query.endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) {
        throw new ValidationDomainException(
          "Invalid endDate format. Must be YYYY-MM-DD."
        );
      }
      parsedEndDate = parseYmdToDate(query.endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new ValidationDomainException(
          "Invalid endDate format. Must be YYYY-MM-DD."
        );
      }
    } else {
      parsedEndDate = today;
    }

    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);
    if (parsedEndDate > endOfToday) {
      throw new ValidationDomainException(
        "Analytics endDate cannot be in the future."
      );
    }

    let parsedStartDate: Date;
    if (query.startDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query.startDate)) {
        throw new ValidationDomainException(
          "Invalid startDate format. Must be YYYY-MM-DD."
        );
      }
      parsedStartDate = parseYmdToDate(query.startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new ValidationDomainException(
          "Invalid startDate format. Must be YYYY-MM-DD."
        );
      }
    } else {
      // Default: 30 days including endDate
      parsedStartDate = addDays(parsedEndDate, -29);
    }

    if (parsedStartDate > parsedEndDate) {
      throw new ValidationDomainException(
        "startDate cannot be after endDate."
      );
    }

    const diffDays = Math.round(
      (parsedEndDate.getTime() - parsedStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (diffDays > 730) {
      throw new ValidationDomainException(
        "Analytics date range cannot exceed 730 days (2 years)."
      );
    }

    // 3. Lookback window: fetch starting 6 days before parsedStartDate for warm 7-SMA
    const lookbackStartDate = addDays(parsedStartDate, -6);

    const logs = await this.milkLogRepository.findLogsForAnalytics(farmId, {
      animalId: query.animalId,
      startDate: lookbackStartDate,
      endDate: parsedEndDate,
      entryType: query.entryType,
    });

    // 4. Compute aggregated analytics
    const daily = MilkYieldAnalyticsCalculator.computeDailyYieldPoints(
      logs,
      parsedStartDate,
      parsedEndDate
    );
    const weekly = MilkYieldAnalyticsCalculator.computeWeeklyYieldPoints(daily);
    const monthly = MilkYieldAnalyticsCalculator.computeMonthlyYieldPoints(daily);

    const recordsInRange = logs.filter(
      (l) =>
        l.loggedDate >= parsedStartDate && l.loggedDate <= parsedEndDate
    ).length;

    const summary = MilkYieldAnalyticsCalculator.computeSummaryStatistics(
      daily,
      recordsInRange
    );

    return {
      farmId,
      animalId: query.animalId ?? null,
      startDate: formatDateToYmd(parsedStartDate),
      endDate: formatDateToYmd(parsedEndDate),
      summary,
      daily,
      weekly,
      monthly,
    };
  }
}
