import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  PaginatedVaccineReminderLogsDto,
  ReminderChannel,
  ReminderDispatchDetailDto,
  ReminderMilestone,
  ReminderStatus,
  ScheduleScanResultDto,
  VaccineReminderLogQueryDto,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineReminderLogEntity } from "../entities/vaccine-reminder-log.entity";
import {
  IVaccineRecordRepository,
  VACCINE_RECORD_REPOSITORY,
} from "../repositories/vaccine-record.repository.interface";
import {
  IVaccineReminderLogRepository,
  VACCINE_REMINDER_LOG_REPOSITORY,
} from "../repositories/vaccine-reminder-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "../providers/notification-provider.interface";
import { IVaccineNotificationService } from "./vaccine-notification.service.interface";

@Injectable()
export class VaccineNotificationService implements IVaccineNotificationService {
  private readonly logger = new Logger(VaccineNotificationService.name);

  constructor(
    @Inject(VACCINE_RECORD_REPOSITORY)
    private readonly vaccineRecordRepository: IVaccineRecordRepository,
    @Inject(VACCINE_REMINDER_LOG_REPOSITORY)
    private readonly reminderLogRepository: IVaccineReminderLogRepository,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: ISmsNotificationProvider,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    private readonly prisma: PrismaService
  ) {}

  public async processFarmDueReminders(
    farmId: string,
    asOfDate?: Date,
    daysAhead = 7,
    dryRun = false,
    traceId?: string
  ): Promise<ScheduleScanResultDto> {
    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const scanDate = baseDate.toISOString().slice(0, 10);

    this.logger.log(
      `Running preventative schedule reminder scan for farm [${farmId}] as of ${scanDate} (daysAhead: ${daysAhead}, dryRun: ${dryRun})`
    );

    // 1. Find all candidate records due within horizon or overdue
    const records =
      await this.vaccineRecordRepository.findRecordsForReminderScan(
        farmId,
        daysAhead,
        baseDate
      );

    // 2. Fetch farm recipient details
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
    });

    const primaryRecipientUserId = farm?.ownerId ?? null;
    const primaryPhone = farm?.owner?.phone ?? "+10000000000";

    const details: ReminderDispatchDetailDto[] = [];
    let dispatchedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const record of records) {
      if (!record.nextDueDate) continue;

      const milestone = this.calculateMilestone(record.nextDueDate, baseDate);
      if (!milestone) continue;

      const tagNumber = record.animal?.tagNumber ?? "Unknown";
      const species = record.animal?.species ?? "Livestock";
      const vaccineName = record.vaccineName;
      const recordType = record.recordType;

      const message = this.buildReminderMessage({
        species,
        tagNumber,
        recordType,
        vaccineName,
        dueDate: record.nextDueDate,
        milestone,
      });

      // We dispatch via SMS and PUSH channels
      const channels = [ReminderChannel.SMS, ReminderChannel.PUSH];

      for (const channel of channels) {
        const alreadySent = await this.reminderLogRepository.hasReminderBeenSent(
          record.id,
          milestone,
          channel,
          scanDate
        );

        if (alreadySent) {
          skippedCount++;
          details.push({
            vaccineRecordId: record.id,
            tagNumber,
            vaccineName,
            milestone,
            channel,
            status: ReminderStatus.SKIPPED,
            reason: "Already dispatched for milestone today",
          });
          continue;
        }

        if (dryRun) {
          details.push({
            vaccineRecordId: record.id,
            tagNumber,
            vaccineName,
            milestone,
            channel,
            status: ReminderStatus.PENDING,
            reason: "Dry run preview - dispatch omitted",
          });
          continue;
        }

        // Actual dispatch
        let isSuccess = true;
        let errorMessage: string | null = null;

        try {
          if (channel === ReminderChannel.SMS) {
            const smsResult = await this.smsProvider.sendSms({
              to: primaryPhone,
              body: message,
              metadata: {
                farmId,
                animalId: record.animalId,
                vaccineRecordId: record.id,
                traceId,
              },
            });
            if (!smsResult.success) {
              isSuccess = false;
              errorMessage = smsResult.error ?? "SMS delivery failed";
            }
          } else {
            const pushResult = await this.pushProvider.sendPush({
              userId: primaryRecipientUserId ?? farmId,
              title: `Preventative Health: ${species} ${tagNumber}`,
              body: message,
              data: {
                farmId,
                animalId: record.animalId,
                vaccineRecordId: record.id,
                milestone,
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

        const logEntity = VaccineReminderLogEntity.create({
          farmId,
          vaccineRecordId: record.id,
          animalId: record.animalId,
          recipientUserId: primaryRecipientUserId,
          recipientPhone: primaryPhone,
          channel,
          milestone,
          status: isSuccess ? ReminderStatus.SENT : ReminderStatus.FAILED,
          message,
          errorMessage,
          dispatchedDate: scanDate,
          dispatchedAt: baseDate,
        });

        await this.reminderLogRepository.create(logEntity);

        if (isSuccess) {
          dispatchedCount++;
          details.push({
            vaccineRecordId: record.id,
            tagNumber,
            vaccineName,
            milestone,
            channel,
            status: ReminderStatus.SENT,
          });
        } else {
          failedCount++;
          details.push({
            vaccineRecordId: record.id,
            tagNumber,
            vaccineName,
            milestone,
            channel,
            status: ReminderStatus.FAILED,
            reason: errorMessage ?? undefined,
          });
        }
      }
    }

    return {
      farmId,
      scanDate,
      totalScanned: records.length,
      dueWithinHorizon: details.length,
      remindersDispatched: dispatchedCount,
      remindersSkipped: skippedCount,
      remindersFailed: failedCount,
      details,
    };
  }

  public async dispatchReminderForRecord(
    vaccineRecordId: string,
    farmId: string,
    milestone: ReminderMilestone,
    channel?: ReminderChannel,
    asOfDate?: Date,
    traceId?: string
  ): Promise<ReminderDispatchDetailDto[]> {
    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const scanDate = baseDate.toISOString().slice(0, 10);

    const record = await this.vaccineRecordRepository.findById(
      vaccineRecordId,
      farmId
    );
    if (!record || !record.nextDueDate) {
      return [];
    }

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    const primaryRecipientUserId = farm?.ownerId ?? null;
    const primaryPhone = farm?.owner?.phone ?? "+10000000000";

    const tagNumber = record.animal?.tagNumber ?? "Unknown";
    const species = record.animal?.species ?? "Livestock";
    const vaccineName = record.vaccineName;
    const recordType = record.recordType;

    const message = this.buildReminderMessage({
      species,
      tagNumber,
      recordType,
      vaccineName,
      dueDate: record.nextDueDate,
      milestone,
    });

    const targetChannels = channel
      ? [channel]
      : [ReminderChannel.SMS, ReminderChannel.PUSH];

    const results: ReminderDispatchDetailDto[] = [];

    for (const ch of targetChannels) {
      const alreadySent = await this.reminderLogRepository.hasReminderBeenSent(
        record.id,
        milestone,
        ch,
        scanDate
      );

      if (alreadySent) {
        results.push({
          vaccineRecordId: record.id,
          tagNumber,
          vaccineName,
          milestone,
          channel: ch,
          status: ReminderStatus.SKIPPED,
          reason: "Already dispatched today",
        });
        continue;
      }

      let isSuccess = true;
      let errorMessage: string | null = null;

      try {
        if (ch === ReminderChannel.SMS) {
          const smsResult = await this.smsProvider.sendSms({
            to: primaryPhone,
            body: message,
            metadata: {
              farmId,
              animalId: record.animalId,
              vaccineRecordId: record.id,
              traceId,
            },
          });
          if (!smsResult.success) {
            isSuccess = false;
            errorMessage = smsResult.error ?? "SMS delivery failed";
          }
        } else {
          const pushResult = await this.pushProvider.sendPush({
            userId: primaryRecipientUserId ?? farmId,
            title: `Preventative Health: ${species} ${tagNumber}`,
            body: message,
            data: {
              farmId,
              animalId: record.animalId,
              vaccineRecordId: record.id,
              milestone,
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

      const logEntity = VaccineReminderLogEntity.create({
        farmId,
        vaccineRecordId: record.id,
        animalId: record.animalId,
        recipientUserId: primaryRecipientUserId,
        recipientPhone: primaryPhone,
        channel: ch,
        milestone,
        status: isSuccess ? ReminderStatus.SENT : ReminderStatus.FAILED,
        message,
        errorMessage,
        dispatchedDate: scanDate,
        dispatchedAt: baseDate,
      });

      await this.reminderLogRepository.create(logEntity);

      results.push({
        vaccineRecordId: record.id,
        tagNumber,
        vaccineName,
        milestone,
        channel: ch,
        status: isSuccess ? ReminderStatus.SENT : ReminderStatus.FAILED,
        reason: errorMessage ?? undefined,
      });
    }

    return results;
  }

  public async listReminderLogs(
    farmId: string,
    query: VaccineReminderLogQueryDto
  ): Promise<PaginatedVaccineReminderLogsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const { items, total } = await this.reminderLogRepository.findMany(farmId, {
      animalId: query.animalId,
      vaccineRecordId: query.vaccineRecordId,
      channel: query.channel,
      milestone: query.milestone,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((item) => item.toResponseDto()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
    };
  }

  private calculateMilestone(
    dueDate: Date,
    asOfDate: Date
  ): ReminderMilestone | null {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const today = new Date(asOfDate);
    today.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return ReminderMilestone.OVERDUE;
    } else if (diffDays === 0) {
      return ReminderMilestone.DUE_TODAY;
    } else if (diffDays <= 3) {
      return ReminderMilestone.THREE_DAYS;
    } else if (diffDays <= 7) {
      return ReminderMilestone.SEVEN_DAYS;
    } else {
      return null;
    }
  }

  private buildReminderMessage(params: {
    species: string;
    tagNumber: string;
    recordType: string;
    vaccineName: string;
    dueDate: Date;
    milestone: ReminderMilestone;
  }): string {
    const dueDateStr = params.dueDate.toISOString().slice(0, 10);
    const typeLabel = params.recordType.toLowerCase();

    switch (params.milestone) {
      case ReminderMilestone.OVERDUE:
        return `[VETRALINK] ALERT: ${params.species} '${params.tagNumber}' is OVERDUE for ${typeLabel} '${params.vaccineName}' since ${dueDateStr}. Urgent action required.`;
      case ReminderMilestone.DUE_TODAY:
        return `[VETRALINK] Action Required: ${params.species} '${params.tagNumber}' is due TODAY for ${typeLabel} '${params.vaccineName}'. Please administer and log.`;
      case ReminderMilestone.THREE_DAYS:
        return `[VETRALINK] Reminder: ${params.species} '${params.tagNumber}' is due for ${typeLabel} '${params.vaccineName}' in 3 days (${dueDateStr}). Prepare doses.`;
      case ReminderMilestone.SEVEN_DAYS:
      default:
        return `[VETRALINK] Advance Notice: ${params.species} '${params.tagNumber}' is scheduled for ${typeLabel} '${params.vaccineName}' in 7 days (${dueDateStr}). Check inventory.`;
    }
  }
}
