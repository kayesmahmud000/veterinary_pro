import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { VaccineReminderJobPayload } from "@vetralink/shared-types";
import {
  IVaccineReminderQueueService,
  VACCINE_REMINDER_QUEUE,
} from "./vaccine-reminder-queue.service.interface";

@Injectable()
export class VaccineReminderQueueService
  implements IVaccineReminderQueueService, OnModuleInit
{
  private readonly logger = new Logger(VaccineReminderQueueService.name);

  constructor(
    @InjectQueue(VACCINE_REMINDER_QUEUE)
    private readonly queue: Queue<VaccineReminderJobPayload>
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        "SCAN_ALL_FARMS",
        {
          jobType: "SCAN_ALL_FARMS",
          traceId: "cron-daily-bootstrap",
        },
        {
          repeat: {
            pattern: "0 6 * * *", // 06:00 UTC daily
          },
          jobId: "cron-daily-vaccine-reminder-scan",
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      this.logger.log("Registered repeatable daily vaccine reminder cron job (06:00 UTC)");
    } catch (err) {
      this.logger.error(
        `Failed to register repeatable vaccine reminder cron: ${(err as Error).message}`
      );
    }
  }

  public async dispatchAllFarmsScan(traceId?: string): Promise<string> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const jobId = `scan-all-farms-${Date.now()}`;

    const job = await this.queue.add(
      "SCAN_ALL_FARMS",
      {
        jobType: "SCAN_ALL_FARMS",
        traceId: activeTraceId,
      },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    this.logger.log(`Dispatched SCAN_ALL_FARMS job [${job.id}]`);
    return job.id!;
  }

  public async dispatchFarmScan(
    farmId: string,
    asOfDate?: string,
    daysAhead = 7,
    dryRun = false,
    traceId?: string
  ): Promise<string> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const dateKey = asOfDate ?? new Date().toISOString().slice(0, 10);
    const jobId = `scan-farm-${farmId}-${dateKey}-${Date.now()}`;

    const job = await this.queue.add(
      "SCAN_FARM",
      {
        jobType: "SCAN_FARM",
        farmId,
        asOfDate,
        daysAhead,
        dryRun,
        traceId: activeTraceId,
      },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
      }
    );

    this.logger.log(
      `Dispatched SCAN_FARM job [${job.id}] for farm [${farmId}] (asOfDate: ${dateKey})`
    );
    return job.id!;
  }

  public async dispatchReminder(
    payload: VaccineReminderJobPayload
  ): Promise<string> {
    const recordId = payload.reminderDetails?.vaccineRecordId ?? "unknown";
    const milestone = payload.reminderDetails?.milestone ?? "unknown";
    const jobId = `reminder-${recordId}-${milestone}-${Date.now()}`;

    const job = await this.queue.add("DISPATCH_REMINDER", payload, {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });

    this.logger.log(
      `Dispatched DISPATCH_REMINDER job [${job.id}] for record [${recordId}] milestone [${milestone}]`
    );
    return job.id!;
  }
}
