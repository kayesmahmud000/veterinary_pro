import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { HealthEscalationJobPayload } from "@vetralink/shared-types";
import {
  HEALTH_ESCALATION_QUEUE,
  IHealthEscalationQueueService,
} from "./health-escalation-queue.service.interface";

@Injectable()
export class HealthEscalationQueueService
  implements IHealthEscalationQueueService, OnModuleInit
{
  private readonly logger = new Logger(HealthEscalationQueueService.name);

  constructor(
    @InjectQueue(HEALTH_ESCALATION_QUEUE)
    private readonly queue: Queue<HealthEscalationJobPayload>
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        "SCAN_ALL_FARMS",
        {
          jobType: "SCAN_ALL_FARMS",
          traceId: "cron-escalation-bootstrap",
        },
        {
          repeat: {
            pattern: "0 */6 * * *", // Every 6 hours
          },
          jobId: "cron-health-escalation-scan",
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      this.logger.log(
        "Registered repeatable health escalation cron job (every 6 hours: 0 */6 * * *)"
      );
    } catch (err) {
      this.logger.error(
        `Failed to register repeatable health escalation cron: ${(err as Error).message}`
      );
    }
  }

  public async dispatchAllFarmsScan(traceId?: string): Promise<string> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const jobId = `scan-all-farms-escalation-${Date.now()}`;

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

    this.logger.log(`Dispatched SCAN_ALL_FARMS escalation job [${job.id}]`);
    return job.id!;
  }

  public async dispatchFarmScan(
    farmId: string,
    asOfDate?: string,
    dryRun = false,
    traceId?: string
  ): Promise<string> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const dateKey = asOfDate ?? new Date().toISOString().slice(0, 10);
    const jobId = `scan-farm-escalation-${farmId}-${dateKey}-${Date.now()}`;

    const job = await this.queue.add(
      "SCAN_FARM",
      {
        jobType: "SCAN_FARM",
        farmId,
        asOfDate,
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
      `Dispatched SCAN_FARM escalation job [${job.id}] for farm [${farmId}]`
    );
    return job.id!;
  }

  public async dispatchEscalation(
    payload: HealthEscalationJobPayload
  ): Promise<string> {
    const recordId = payload.incidentDetails?.healthRecordId ?? "unknown";
    const level = payload.incidentDetails?.targetLevel ?? "unknown";
    const jobId = `escalate-${recordId}-${level}-${Date.now()}`;

    const job = await this.queue.add("ESCALATE_INCIDENT", payload, {
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
      `Dispatched ESCALATE_INCIDENT job [${job.id}] for record [${recordId}] level [${level}]`
    );
    return job.id!;
  }
}
