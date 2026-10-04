import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AcknowledgeMilkAnomalyRequestDto,
  AnimalGender,
  AnimalStatus,
  AnomalyScanResultDto,
  MilkAnomalyQueryRequestDto,
  MilkAnomalyResponseDto,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  PaginatedMilkAnomaliesDto,
  ResolveMilkAnomalyRequestDto,
  TriggerAnomalyScanRequestDto,
} from "@vetralink/shared-types";
import {
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
import { MilkYieldAnomalyEntity } from "../entities/milk-yield-anomaly.entity";
import {
  IMilkLogRepository,
  MILK_LOG_REPOSITORY,
} from "../repositories/milk-log.repository.interface";
import {
  IMilkYieldAnomalyRepository,
  MILK_YIELD_ANOMALY_REPOSITORY,
} from "../repositories/milk-yield-anomaly.repository.interface";
import {
  IMilkAnomalyQueueService,
  MILK_ANOMALY_QUEUE_SERVICE,
} from "./milk-anomaly-queue.service.interface";
import { IMilkAnomalyService } from "./milk-anomaly.service.interface";
import {
  addDays,
  formatDateToYmd,
  parseYmdToDate,
  round,
} from "../utils/milk-yield-analytics.util";

@Injectable()
export class MilkAnomalyService implements IMilkAnomalyService {
  private readonly logger = new Logger(MilkAnomalyService.name);

  constructor(
    @Inject(MILK_YIELD_ANOMALY_REPOSITORY)
    private readonly anomalyRepository: IMilkYieldAnomalyRepository,
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

  public async evaluateAnimalYieldDrop(
    farmId: string,
    animalId: string,
    targetDate: Date,
    traceId?: string
  ): Promise<MilkAnomalyResponseDto | null> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // 1. Validate animal existence and physiological status
    const animal = await this.animalRepository.findById(animalId, farmId);
    if (!animal) {
      this.logger.warn(
        `Cannot evaluate yield drop: animal [${animalId}] not found in farm [${farmId}]`
      );
      return null;
    }

    if (animal.gender !== AnimalGender.FEMALE || animal.status !== AnimalStatus.ACTIVE) {
      return null;
    }

    // 2. Fetch target day's cumulative milk logs for this animal
    const targetDateNormalized = new Date(
      Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())
    );

    const currentLogs = await this.milkLogRepository.findLogsForAnalytics(farmId, {
      animalId,
      startDate: targetDateNormalized,
      endDate: targetDateNormalized,
    });

    if (currentLogs.length === 0) {
      return null;
    }

    const currentYieldLiters = round(
      currentLogs.reduce((acc, log) => acc + log.yieldLiters, 0)
    );

    // 3. Query baseline logs for the trailing 7 days [targetDate - 7, targetDate - 1]
    const baselineStartDate = addDays(targetDateNormalized, -7);
    const baselineEndDate = addDays(targetDateNormalized, -1);

    const baselineLogs = await this.milkLogRepository.findLogsForAnalytics(farmId, {
      animalId,
      startDate: baselineStartDate,
      endDate: baselineEndDate,
    });

    // Group baseline logs by YYYY-MM-DD
    const baselineDailyMap = new Map<string, number>();
    for (const log of baselineLogs) {
      const dKey = formatDateToYmd(log.loggedDate);
      baselineDailyMap.set(dKey, (baselineDailyMap.get(dKey) ?? 0) + log.yieldLiters);
    }

    const activeDays = baselineDailyMap.size;
    // Eligibility: Must have at least 2 active days in the trailing week
    if (activeDays < 2) {
      return null;
    }

    const totalBaselineYield = Array.from(baselineDailyMap.values()).reduce(
      (a, b) => a + b,
      0
    );
    const baselineYieldLiters = round(totalBaselineYield / activeDays);

    // Filter out dry/weaning animals with baseline < 2.0 Liters
    if (baselineYieldLiters < 2.0) {
      return null;
    }

    // 4. Calculate drop percentage
    const dropPercentage = round(
      ((baselineYieldLiters - currentYieldLiters) / baselineYieldLiters) * 100
    );

    // Threshold check: drop must be >= 20%
    if (dropPercentage < 20.0) {
      return null;
    }

    // 5. Determine severity tier
    let severity: MilkAnomalySeverity;
    if (dropPercentage >= 50.0) {
      severity = MilkAnomalySeverity.CRITICAL;
    } else if (dropPercentage >= 30.0) {
      severity = MilkAnomalySeverity.MEDIUM;
    } else {
      severity = MilkAnomalySeverity.LOW;
    }

    const metadata = {
      baselineActiveDays: activeDays,
      baselineWindow: [
        formatDateToYmd(baselineStartDate),
        formatDateToYmd(baselineEndDate),
      ],
      currentSessionsCount: currentLogs.length,
    };

    // 6. Upsert anomaly record (deduplicated by [farmId, animalId, loggedDate])
    let savedEntity!: MilkYieldAnomalyEntity;
    const existing = await this.anomalyRepository.findByAnimalAndDate(
      farmId,
      animalId,
      targetDateNormalized
    );

    if (existing) {
      existing.updateMetrics(
        currentYieldLiters,
        baselineYieldLiters,
        dropPercentage,
        severity,
        metadata
      );
      savedEntity = await this.anomalyRepository.save(existing);
    } else {
      const newEntity = MilkYieldAnomalyEntity.create({
        farmId,
        animalId,
        loggedDate: targetDateNormalized,
        currentYieldLiters,
        baselineYieldLiters,
        dropPercentage,
        severity,
        metadata,
      });
      savedEntity = await this.anomalyRepository.upsert(newEntity);
    }

    // 7. Audit trail
    await this.auditLogRepository.record({
      userId: undefined,
      action: "MILK_ANOMALY_FLAGGED",
      entityType: "MilkYieldAnomaly",
      entityId: savedEntity.id,
      newValues: savedEntity.toResponseDto() as unknown as Record<string, unknown>,
      traceId: activeTraceId,
    });

    this.logger.warn(
      `FLAGGED MILK ANOMALY for animal [${animal.tagNumber}] on ${formatDateToYmd(
        targetDateNormalized
      )}: current ${currentYieldLiters}L vs baseline ${baselineYieldLiters}L (-${dropPercentage}%) [${severity}]`
    );

    return savedEntity.toResponseDto();
  }

  public async runFarmDailyScan(
    farmId: string,
    targetDate: Date,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnomalyScanResultDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();

    // Query all active female animals in the farm
    const { items: animals } = await this.animalRepository.findMany(farmId, {
      status: AnimalStatus.ACTIVE,
      gender: AnimalGender.FEMALE,
      limit: 1000,
    });

    const detectedAnomalyIds: string[] = [];

    for (const animal of animals) {
      try {
        const anomaly = await this.evaluateAnimalYieldDrop(
          farmId,
          animal.id,
          targetDate,
          activeTraceId
        );
        if (anomaly) {
          detectedAnomalyIds.push(anomaly.id);
        }
      } catch (err) {
        this.logger.error(
          `Error scanning animal [${animal.id}] for anomalies on ${formatDateToYmd(
            targetDate
          )}: ${(err as Error).message}`
        );
      }
    }

    if (actorUserId) {
      await this.auditLogRepository.record({
        userId: actorUserId,
        action: "FARM_ANOMALY_SCAN_EXECUTED",
        entityType: "Farm",
        entityId: farmId,
        newValues: {
          targetDate: formatDateToYmd(targetDate),
          scannedAnimalsCount: animals.length,
          anomaliesDetectedCount: detectedAnomalyIds.length,
        },
        traceId: activeTraceId,
      });
    }

    return {
      farmId,
      targetDate: formatDateToYmd(targetDate),
      scannedAnimalsCount: animals.length,
      anomaliesDetectedCount: detectedAnomalyIds.length,
      detectedAnomalyIds,
    };
  }

  public async queryAnomalies(
    farmId: string,
    query: MilkAnomalyQueryRequestDto
  ): Promise<PaginatedMilkAnomaliesDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const startDate = query.startDate ? parseYmdToDate(query.startDate) : undefined;
    const endDate = query.endDate ? parseYmdToDate(query.endDate) : undefined;

    const { items, total } = await this.anomalyRepository.findMany(farmId, {
      animalId: query.animalId,
      severity: query.severity,
      status: query.status,
      startDate,
      endDate,
      page,
      limit,
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

  public async getAnomalyById(
    id: string,
    farmId: string
  ): Promise<MilkAnomalyResponseDto> {
    const anomaly = await this.anomalyRepository.findById(id, farmId);
    if (!anomaly) {
      throw new EntityNotFoundException("MilkYieldAnomaly", id);
    }
    return anomaly.toResponseDto();
  }

  public async acknowledgeAnomaly(
    id: string,
    farmId: string,
    userId: string,
    dto: AcknowledgeMilkAnomalyRequestDto
  ): Promise<MilkAnomalyResponseDto> {
    const anomaly = await this.anomalyRepository.findById(id, farmId);
    if (!anomaly) {
      throw new EntityNotFoundException("MilkYieldAnomaly", id);
    }

    const oldValues = anomaly.toResponseDto();
    anomaly.acknowledge(userId, dto.clinicalNotes);

    const saved = await this.anomalyRepository.save(anomaly);

    await this.auditLogRepository.record({
      userId,
      action: "MILK_ANOMALY_ACKNOWLEDGED",
      entityType: "MilkYieldAnomaly",
      entityId: id,
      oldValues: oldValues as unknown as Record<string, unknown>,
      newValues: saved.toResponseDto() as unknown as Record<string, unknown>,
      traceId: crypto.randomUUID(),
    });

    return saved.toResponseDto();
  }

  public async resolveAnomaly(
    id: string,
    farmId: string,
    userId: string,
    dto: ResolveMilkAnomalyRequestDto
  ): Promise<MilkAnomalyResponseDto> {
    const anomaly = await this.anomalyRepository.findById(id, farmId);
    if (!anomaly) {
      throw new EntityNotFoundException("MilkYieldAnomaly", id);
    }

    const oldValues = anomaly.toResponseDto();
    anomaly.resolve(userId, dto.resolutionNotes, dto.status);

    const saved = await this.anomalyRepository.save(anomaly);

    await this.auditLogRepository.record({
      userId,
      action: "MILK_ANOMALY_RESOLVED",
      entityType: "MilkYieldAnomaly",
      entityId: id,
      oldValues: oldValues as unknown as Record<string, unknown>,
      newValues: saved.toResponseDto() as unknown as Record<string, unknown>,
      traceId: crypto.randomUUID(),
    });

    return saved.toResponseDto();
  }

  public async triggerFarmScan(
    farmId: string,
    userId: string,
    dto: TriggerAnomalyScanRequestDto
  ): Promise<{ jobId: string; farmId: string; targetDate: string }> {
    let targetDateStr: string;

    if (dto.targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.targetDate)) {
        throw new ValidationDomainException(
          "Invalid targetDate format. Must be YYYY-MM-DD."
        );
      }
      const parsed = parseYmdToDate(dto.targetDate);
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      if (parsed > today) {
        throw new ValidationDomainException("Scan targetDate cannot be in the future.");
      }
      targetDateStr = dto.targetDate;
    } else {
      targetDateStr = formatDateToYmd(new Date());
    }

    const jobId = await this.anomalyQueueService.dispatchFarmDailyScan(
      farmId,
      targetDateStr,
      userId
    );

    return {
      jobId,
      farmId,
      targetDate: targetDateStr,
    };
  }
}
