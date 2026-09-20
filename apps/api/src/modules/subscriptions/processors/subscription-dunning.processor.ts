import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DunningJobPayload } from "@vetralink/shared-types";
import {
  ISubscriptionDunningService,
  SUBSCRIPTION_DUNNING_SERVICE,
} from "../services/subscription-dunning.service.interface";
import { SUBSCRIPTION_DUNNING_QUEUE } from "../services/subscription-dunning-queue.service.interface";

@Injectable()
@Processor(SUBSCRIPTION_DUNNING_QUEUE)
export class SubscriptionDunningProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionDunningProcessor.name);

  constructor(
    @Inject(SUBSCRIPTION_DUNNING_SERVICE)
    private readonly dunningService: ISubscriptionDunningService,
  ) {
    super();
  }

  public async process(job: Job<DunningJobPayload>): Promise<unknown> {
    const {
      jobType,
      subscriptionId,
      stage,
      channel,
      gatewayInvoiceId,
      traceId,
      dryRun,
      asOfDate,
    } = job.data;

    this.logger.log(
      `Processing dunning job [${job.id}] type [${jobType}] for sub [${
        subscriptionId ?? "ALL"
      }]`,
    );

    if (jobType === "SCAN_ALL_PAST_DUE") {
      await job.updateProgress(10);
      const result = await this.dunningService.scanAndDispatchDunning(
        {
          dryRun,
          asOfDate,
          targetSubscriptionId: subscriptionId,
        },
        traceId,
      );
      await job.updateProgress(100);
      return result;
    }

    if (jobType === "DISPATCH_DUNNING_STAGE") {
      if (!subscriptionId || !stage) {
        throw new Error(
          `DISPATCH_DUNNING_STAGE requires subscriptionId and stage (received: sub=${subscriptionId}, stage=${stage})`,
        );
      }

      await job.updateProgress(20);
      const result = await this.dunningService.dispatchDunningStage({
        subscriptionId,
        stage,
        channel,
        gatewayInvoiceId,
        traceId,
      });
      await job.updateProgress(100);
      return result;
    }

    this.logger.warn(`Unknown dunning job type: ${jobType}`);
    return { ignored: true, reason: `Unknown jobType: ${jobType}` };
  }
}
