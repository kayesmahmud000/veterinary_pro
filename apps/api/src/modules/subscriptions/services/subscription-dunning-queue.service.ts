import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  DunningChannel,
  DunningJobPayload,
  DunningStage,
  TriggerDunningScanDto,
} from "@vetralink/shared-types";
import {
  ISubscriptionDunningQueueService,
  SUBSCRIPTION_DUNNING_QUEUE,
} from "./subscription-dunning-queue.service.interface";

@Injectable()
export class SubscriptionDunningQueueService
  implements ISubscriptionDunningQueueService, OnModuleInit
{
  private readonly logger = new Logger(SubscriptionDunningQueueService.name);

  constructor(
    @InjectQueue(SUBSCRIPTION_DUNNING_QUEUE)
    private readonly queue: Queue<DunningJobPayload>,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        "SCAN_ALL_PAST_DUE",
        {
          jobType: "SCAN_ALL_PAST_DUE",
          traceId: "cron-daily-dunning-bootstrap",
        },
        {
          repeat: {
            pattern: "0 7 * * *", // 07:00 UTC daily
          },
          jobId: "cron-daily-subscription-dunning-scan",
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(
        "Registered repeatable daily subscription dunning cron job (07:00 UTC)",
      );
    } catch (err) {
      this.logger.error(
        `Failed to register repeatable subscription dunning cron: ${
          (err as Error).message
        }`,
      );
    }
  }

  public async dispatchScan(
    options?: TriggerDunningScanDto,
    traceId?: string,
  ): Promise<string> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const jobId = `dunning-scan-${Date.now()}`;

    const job = await this.queue.add(
      "SCAN_ALL_PAST_DUE",
      {
        jobType: "SCAN_ALL_PAST_DUE",
        dryRun: options?.dryRun,
        asOfDate: options?.asOfDate,
        subscriptionId: options?.targetSubscriptionId,
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
      },
    );

    this.logger.log(`Dispatched SCAN_ALL_PAST_DUE job [${job.id}]`);
    return job.id!;
  }

  public async dispatchStage(params: {
    subscriptionId: string;
    stage: DunningStage;
    channel?: DunningChannel;
    gatewayInvoiceId?: string;
    traceId?: string;
  }): Promise<string> {
    const {
      subscriptionId,
      stage,
      channel = DunningChannel.EMAIL,
      gatewayInvoiceId,
    } = params;
    const activeTraceId = params.traceId ?? crypto.randomUUID();
    const jobId = `dunning-stage-${subscriptionId}-${stage}-${Date.now()}`;

    const job = await this.queue.add(
      "DISPATCH_DUNNING_STAGE",
      {
        jobType: "DISPATCH_DUNNING_STAGE",
        subscriptionId,
        stage,
        channel,
        gatewayInvoiceId,
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
      },
    );

    this.logger.log(
      `Dispatched DISPATCH_DUNNING_STAGE job [${job.id}] for sub [${subscriptionId}] stage [${stage}]`,
    );
    return job.id!;
  }
}
