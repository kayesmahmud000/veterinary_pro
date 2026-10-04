import {
  WatermarkJobData,
  WatermarkJobResult,
  WatermarkJobStatus,
} from "@vetralink/shared-types";

export const WATERMARK_QUEUE = "watermark";

export interface WatermarkJobStatusDto {
  readonly jobId: string;
  readonly state: WatermarkJobStatus | string;
  readonly progress: number;
  readonly data: WatermarkJobData;
  readonly result?: WatermarkJobResult;
  readonly failedReason?: string;
}

export interface IWatermarkQueueService {
  /**
   * Dispatches a watermarking job to BullMQ queue.
   */
  dispatchWatermarkJob(data: WatermarkJobData): Promise<{ jobId: string }>;

  /**
   * Checks the status of an existing watermark job by ID.
   */
  getJobStatus(jobId: string): Promise<WatermarkJobStatusDto | null>;
}

export const WATERMARK_QUEUE_SERVICE = "WATERMARK_QUEUE_SERVICE";
