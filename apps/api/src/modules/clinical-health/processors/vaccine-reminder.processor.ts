import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { VaccineReminderJobPayload } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  IVaccineNotificationService,
  VACCINE_NOTIFICATION_SERVICE,
} from "../services/vaccine-notification.service.interface";
import { VACCINE_REMINDER_QUEUE } from "../services/vaccine-reminder-queue.service.interface";

@Injectable()
@Processor(VACCINE_REMINDER_QUEUE)
export class VaccineReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(VaccineReminderProcessor.name);

  constructor(
    @Inject(VACCINE_NOTIFICATION_SERVICE)
    private readonly notificationService: IVaccineNotificationService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  public async process(job: Job<VaccineReminderJobPayload>): Promise<unknown> {
    const {
      jobType,
      farmId,
      asOfDate,
      daysAhead,
      dryRun,
      reminderDetails,
      traceId,
    } = job.data;

    this.logger.log(
      `Processing vaccine reminder job [${job.id}] type [${jobType}] for farm [${farmId ?? "ALL"}]`
    );

    const parsedDate = asOfDate ? new Date(asOfDate) : undefined;

    if (jobType === "SCAN_ALL_FARMS") {
      await job.updateProgress(10);
      const activeFarms = await this.prisma.farm.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      this.logger.log(
        `SCAN_ALL_FARMS: Scanning ${activeFarms.length} active farms for due preventative treatments`
      );

      const summaries = [];
      const totalFarms = activeFarms.length;
      let completedFarms = 0;

      for (const farm of activeFarms) {
        try {
          const summary =
            await this.notificationService.processFarmDueReminders(
              farm.id,
              parsedDate,
              daysAhead ?? 7,
              dryRun ?? false,
              traceId
            );
          summaries.push(summary);
        } catch (farmErr) {
          this.logger.error(
            `Failed scanning reminders for farm [${farm.id}] (${farm.name}): ${(farmErr as Error).message}`
          );
        }
        completedFarms++;
        const progress = Math.round(10 + (completedFarms / Math.max(1, totalFarms)) * 85);
        await job.updateProgress(progress);
      }

      await job.updateProgress(100);
      return {
        totalFarms: activeFarms.length,
        processedFarms: summaries.length,
        summaries,
      };
    }

    if (jobType === "SCAN_FARM") {
      if (!farmId) {
        throw new Error(
          `Invalid SCAN_FARM job [${job.id}]: farmId is required.`
        );
      }

      await job.updateProgress(25);
      const result = await this.notificationService.processFarmDueReminders(
        farmId,
        parsedDate,
        daysAhead ?? 7,
        dryRun ?? false,
        traceId
      );
      await job.updateProgress(100);

      this.logger.log(
        `Completed SCAN_FARM for farm [${farmId}]: ${result.remindersDispatched} dispatched, ${result.remindersSkipped} skipped, ${result.remindersFailed} failed`
      );

      return result;
    }

    if (jobType === "DISPATCH_REMINDER") {
      if (!reminderDetails) {
        throw new Error(
          `Invalid DISPATCH_REMINDER job [${job.id}]: reminderDetails is required.`
        );
      }

      await job.updateProgress(30);
      const results = await this.notificationService.dispatchReminderForRecord(
        reminderDetails.vaccineRecordId,
        reminderDetails.farmId,
        reminderDetails.milestone,
        undefined,
        parsedDate,
        traceId
      );
      await job.updateProgress(100);

      return results;
    }

    throw new Error(`Unsupported vaccine reminder jobType: ${jobType}`);
  }
}
