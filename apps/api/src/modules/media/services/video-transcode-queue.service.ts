import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  TranscodeJobState,
  TranscodeJobStatusResponseDto,
  VideoTranscodeJobData,
  VideoTranscodeResultDto,
} from "@vetralink/shared-types";
import {
  IVideoTranscodeQueueService,
  VIDEO_TRANSCODE_QUEUE,
} from "./video-transcode-queue.service.interface";

@Injectable()
export class VideoTranscodeQueueService implements IVideoTranscodeQueueService {
  private readonly logger = new Logger(VideoTranscodeQueueService.name);

  constructor(
    @InjectQueue(VIDEO_TRANSCODE_QUEUE)
    private readonly transcodeQueue: Queue<
      VideoTranscodeJobData,
      VideoTranscodeResultDto
    >
  ) {}

  public async dispatchTranscodeJob(
    data: VideoTranscodeJobData
  ): Promise<{ jobId: string }> {
    const customJobId = `transcode-${data.productId}-${Date.now()}`;

    const job = await this.transcodeQueue.add("transcode", data, {
      jobId: customJobId,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10000,
      },
      removeOnComplete: { age: 86400 }, // retain completed jobs for 24h
      removeOnFail: { age: 604800 }, // retain failed jobs for 7 days
    });

    this.logger.log(
      `Dispatched video transcode job [${job.id}] for product [${data.productId}] -> ${data.rawS3Key}`
    );

    return { jobId: job.id as string };
  }

  public async getJobStatus(
    jobId: string
  ): Promise<TranscodeJobStatusResponseDto | null> {
    const job = await this.transcodeQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      jobId: job.id as string,
      state: (state as TranscodeJobState) || "unknown",
      progress: typeof job.progress === "number" ? job.progress : 0,
      data: job.data,
      result: job.returnvalue ?? undefined,
      failedReason: job.failedReason ?? undefined,
    };
  }
}
