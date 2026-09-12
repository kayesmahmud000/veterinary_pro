import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  WatermarkJobData,
  WatermarkJobResult,
  WatermarkJobStatus,
} from "@vetralink/shared-types";
import {
  IWatermarkQueueService,
  WATERMARK_QUEUE,
  WatermarkJobStatusDto,
} from "./watermark-queue.service.interface";

@Injectable()
export class WatermarkQueueService implements IWatermarkQueueService {
  private readonly logger = new Logger(WatermarkQueueService.name);

  constructor(
    @InjectQueue(WATERMARK_QUEUE)
    private readonly watermarkQueue: Queue<
      WatermarkJobData,
      WatermarkJobResult
    >
  ) {}

  public async dispatchWatermarkJob(
    data: WatermarkJobData
  ): Promise<{ jobId: string }> {
    const customJobId = `wm-${data.orderId}-${data.orderItemId}-${Date.now()}`;

    const job = await this.watermarkQueue.add("watermark", data, {
      jobId: customJobId,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: { age: 86400 }, // 24h retention
      removeOnFail: { age: 604800 }, // 7d retention
    });

    this.logger.log(
      `Dispatched watermark job [${job.id}] for order [${data.orderId}], item [${data.orderItemId}] -> ${data.sourceS3Key}`
    );

    return { jobId: job.id as string };
  }

  public async getJobStatus(
    jobId: string
  ): Promise<WatermarkJobStatusDto | null> {
    const job = await this.watermarkQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();

    let mappedStatus: WatermarkJobStatus | string = state;
    if (state === "completed") {
      mappedStatus = WatermarkJobStatus.COMPLETED;
    } else if (state === "failed") {
      mappedStatus = WatermarkJobStatus.FAILED;
    } else if (state === "active") {
      mappedStatus = WatermarkJobStatus.PROCESSING;
    } else if (state === "waiting" || state === "delayed") {
      mappedStatus = WatermarkJobStatus.QUEUED;
    }

    return {
      jobId: job.id as string,
      state: mappedStatus,
      progress: typeof job.progress === "number" ? job.progress : 0,
      data: job.data,
      result: job.returnvalue ?? undefined,
      failedReason: job.failedReason ?? undefined,
    };
  }
}
