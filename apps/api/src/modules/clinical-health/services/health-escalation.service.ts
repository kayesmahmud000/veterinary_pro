import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  EscalationDispatchDetailDto,
  EscalationScanResultDto,
  HealthEscalationAction,
  HealthEscalationLevel,
  HealthEscalationLogQueryDto,
  HealthEscalationLogResponseDto,
  PaginatedHealthEscalationLogsDto,
  ReminderChannel,
  ReminderStatus,
  SeverityLevel,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthEscalationLogEntity } from "../entities/health-escalation-log.entity";
import { HealthRecordEntity } from "../entities/health-record.entity";
import {
  IHealthRecordRepository,
  HEALTH_RECORD_REPOSITORY,
} from "../repositories/health-record.repository.interface";
import {
  IHealthEscalationLogRepository,
  HEALTH_ESCALATION_LOG_REPOSITORY,
} from "../repositories/health-escalation-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "../providers/notification-provider.interface";
import { IHealthEscalationService } from "./health-escalation.service.interface";

interface EscalationTier {
  level: HealthEscalationLevel;
  action: HealthEscalationAction;
  numericLevel: number;
}

interface RecipientInfo {
  userId: string | null;
  phone: string | null;
  name: string;
}

@Injectable()
export class HealthEscalationService implements IHealthEscalationService {
  private readonly logger = new Logger(HealthEscalationService.name);

  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly healthRecordRepository: IHealthRecordRepository,
    @Inject(HEALTH_ESCALATION_LOG_REPOSITORY)
    private readonly escalationLogRepository: IHealthEscalationLogRepository,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: ISmsNotificationProvider,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    private readonly prisma: PrismaService
  ) {}

  public async processFarmEscalations(
    farmId: string,
    asOfDate?: Date,
    dryRun = false,
    traceId?: string
  ): Promise<EscalationScanResultDto> {
    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const scanDate = baseDate.toISOString().slice(0, 10);

    this.logger.log(
      `Running health escalation scan for farm [${farmId}] as of ${scanDate} (dryRun: ${dryRun})`
    );

    // 1. Verify farm exists and load farm members
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!farm) {
      throw new EntityNotFoundException("Farm", farmId);
    }

    // 2. Fetch all open critical and high severity cases
    const records =
      await this.healthRecordRepository.findUnresolvedCriticalCases(
        farmId,
        baseDate
      );

    const details: EscalationDispatchDetailDto[] = [];
    let totalEligibleForEscalation = 0;
    let escalationsDispatched = 0;
    let escalationsSkipped = 0;
    let escalationsFailed = 0;

    for (const record of records) {
      const hoursUnresolved = Math.max(
        0,
        Math.floor(
          (baseDate.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60)
        )
      );

      const tier = this.determineEscalationTier(record.severity, hoursUnresolved);
      if (!tier) {
        continue;
      }

      totalEligibleForEscalation++;

      const recipient = this.resolveRecipient(record, farm, tier.numericLevel);
      const message = this.buildEscalationMessage(
        record,
        tier.level,
        hoursUnresolved
      );

      const channels = [ReminderChannel.SMS, ReminderChannel.PUSH];

      for (const channel of channels) {
        const alreadyLogged =
          await this.escalationLogRepository.hasEscalationBeenLogged(
            record.id,
            tier.level,
            channel
          );

        if (alreadyLogged) {
          escalationsSkipped++;
          details.push({
            healthRecordId: record.id,
            tagNumber: record.animal?.tagNumber ?? "Unknown",
            diagnosis: record.diagnosis,
            severity: record.severity,
            hoursUnresolved,
            level: tier.level,
            actionTaken: tier.action,
            channel,
            status: ReminderStatus.SKIPPED,
            recipientPhone: recipient.phone ?? undefined,
            reason: `Already escalated to ${tier.level} via ${channel}`,
          });
          continue;
        }

        if (dryRun) {
          details.push({
            healthRecordId: record.id,
            tagNumber: record.animal?.tagNumber ?? "Unknown",
            diagnosis: record.diagnosis,
            severity: record.severity,
            hoursUnresolved,
            level: tier.level,
            actionTaken: tier.action,
            channel,
            status: ReminderStatus.PENDING,
            recipientPhone: recipient.phone ?? undefined,
            reason: "Dry run preview - escalation omitted",
          });
          continue;
        }

        let isSuccess = true;
        let errorMessage: string | null = null;

        try {
          if (channel === ReminderChannel.SMS) {
            const smsResult = await this.smsProvider.sendSms({
              to: recipient.phone ?? "+10000000000",
              body: message,
              metadata: {
                farmId,
                animalId: record.animalId,
                healthRecordId: record.id,
                escalationLevel: tier.level,
                traceId,
              },
            });
            if (!smsResult.success) {
              isSuccess = false;
              errorMessage = smsResult.error ?? "SMS delivery failed";
            }
          } else {
            const pushResult = await this.pushProvider.sendPush({
              userId: recipient.userId ?? farm.ownerId,
              title: `[HEALTH ESCALATION] ${record.animal?.species ?? "Animal"} ${record.animal?.tagNumber ?? ""}`,
              body: message,
              data: {
                farmId,
                animalId: record.animalId,
                healthRecordId: record.id,
                escalationLevel: tier.level,
              },
            });
            if (!pushResult.success) {
              isSuccess = false;
              errorMessage = pushResult.error ?? "Push delivery failed";
            }
          }
        } catch (err) {
          isSuccess = false;
          errorMessage = (err as Error).message;
        }

        const logEntity = HealthEscalationLogEntity.create({
          farmId,
          healthRecordId: record.id,
          animalId: record.animalId,
          level: tier.level,
          actionTaken: tier.action,
          recipientUserId: recipient.userId,
          recipientPhone: recipient.phone,
          channel,
          status: isSuccess ? ReminderStatus.SENT : ReminderStatus.FAILED,
          notes: errorMessage ?? `Escalated to ${tier.level} via ${channel}`,
          hoursUnresolved,
        });

        await this.escalationLogRepository.create(logEntity);

        if (isSuccess) {
          escalationsDispatched++;
          if (record.escalationLevel < tier.numericLevel) {
            record.escalateTo(tier.numericLevel, baseDate);
            await this.healthRecordRepository.update(record);
          }
        } else {
          escalationsFailed++;
        }

        details.push({
          healthRecordId: record.id,
          tagNumber: record.animal?.tagNumber ?? "Unknown",
          diagnosis: record.diagnosis,
          severity: record.severity,
          hoursUnresolved,
          level: tier.level,
          actionTaken: tier.action,
          channel,
          status: isSuccess ? ReminderStatus.SENT : ReminderStatus.FAILED,
          recipientPhone: recipient.phone ?? undefined,
          reason: errorMessage ?? undefined,
        });
      }
    }

    return {
      farmId,
      scanDate,
      totalUnresolvedScanned: records.length,
      totalEligibleForEscalation,
      escalationsDispatched,
      escalationsSkipped,
      escalationsFailed,
      details,
    };
  }

  public async listEscalationLogs(
    farmId: string,
    query: HealthEscalationLogQueryDto
  ): Promise<PaginatedHealthEscalationLogsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.escalationLogRepository.findMany(farmId, {
      animalId: query.animalId,
      healthRecordId: query.healthRecordId,
      level: query.level,
      channel: query.channel,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page,
      limit,
    });

    return {
      items: result.items.map((entity) => entity.toResponseDto()),
      meta: {
        page,
        pageSize: limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  public async listActiveEscalations(
    farmId: string
  ): Promise<HealthEscalationLogResponseDto[]> {
    const records = await this.escalationLogRepository.findActiveEscalations(
      farmId
    );
    return records.map((entity) => entity.toResponseDto());
  }

  private determineEscalationTier(
    severity: SeverityLevel,
    hours: number
  ): EscalationTier | null {
    if (severity === SeverityLevel.CRITICAL) {
      if (hours >= 72) {
        return {
          level: HealthEscalationLevel.LEVEL_3_EMERGENCY_INTERVENTION,
          action: HealthEscalationAction.RECOMMEND_QUARANTINE,
          numericLevel: 3,
        };
      }
      if (hours >= 48) {
        return {
          level: HealthEscalationLevel.LEVEL_2_OWNER_ALERT,
          action: HealthEscalationAction.NOTIFY_FARM_OWNER,
          numericLevel: 2,
        };
      }
      if (hours >= 24) {
        return {
          level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
          action: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
          numericLevel: 1,
        };
      }
    } else if (severity === SeverityLevel.HIGH) {
      if (hours >= 72) {
        return {
          level: HealthEscalationLevel.LEVEL_2_OWNER_ALERT,
          action: HealthEscalationAction.NOTIFY_FARM_OWNER,
          numericLevel: 2,
        };
      }
      if (hours >= 48) {
        return {
          level: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
          action: HealthEscalationAction.NOTIFY_VET_HERDSMAN,
          numericLevel: 1,
        };
      }
    }
    return null;
  }

  private resolveRecipient(
    record: HealthRecordEntity,
    farm: {
      ownerId: string;
      owner?: { id: string; name: string; phone: string | null } | null;
      members?: Array<{
        user: { id: string; name: string; phone: string | null; role?: string };
      }>;
    },
    numericLevel: number
  ): RecipientInfo {
    // For level 2 and 3, escalate directly to farm owner
    if (numericLevel >= 2) {
      return {
        userId: farm.ownerId,
        phone: farm.owner?.phone ?? "+10000000000",
        name: farm.owner?.name ?? "Farm Owner",
      };
    }

    // For level 1, notify attending vet first, then recording herdsman, then farm owner
    if (record.attendingVetId) {
      return {
        userId: record.attendingVetId,
        phone: record.attendingVet ? "+10000000000" : farm.owner?.phone ?? "+10000000000",
        name: record.attendingVet?.name ?? "Attending Vet",
      };
    }

    if (record.recordedById) {
      return {
        userId: record.recordedById,
        phone: record.recordedBy ? "+10000000000" : farm.owner?.phone ?? "+10000000000",
        name: record.recordedBy?.name ?? "Recording Staff",
      };
    }

    return {
      userId: farm.ownerId,
      phone: farm.owner?.phone ?? "+10000000000",
      name: farm.owner?.name ?? "Farm Owner",
    };
  }

  private buildEscalationMessage(
    record: HealthRecordEntity,
    level: HealthEscalationLevel,
    hoursUnresolved: number
  ): string {
    const species = record.animal?.species ?? "Livestock";
    const tagNumber = record.animal?.tagNumber ?? "Unknown";
    const diagnosis = record.diagnosis ? ` (${record.diagnosis})` : "";

    switch (level) {
      case HealthEscalationLevel.LEVEL_3_EMERGENCY_INTERVENTION:
        return `[EMERGENCY HEALTH INTERVENTION] ${species} ${tagNumber}${diagnosis} has been unresolved for ${hoursUnresolved}h. Immediate isolation/quarantine recommended to prevent herd outbreak.`;
      case HealthEscalationLevel.LEVEL_2_OWNER_ALERT:
        return `[ESCALATION - FARM OWNER] ${species} ${tagNumber}${diagnosis} remains unresolved for ${hoursUnresolved}h (Severity: ${record.severity}). Urgent review required.`;
      case HealthEscalationLevel.LEVEL_1_STAFF_ALERT:
      default:
        return `[CRITICAL HEALTH ALERT] ${species} ${tagNumber}${diagnosis} has unresolved ${record.severity} illness for ${hoursUnresolved}h. Immediate veterinary attention required.`;
    }
  }
}
