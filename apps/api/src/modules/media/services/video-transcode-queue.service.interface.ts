import {
  TranscodeJobStatusResponseDto,
  VideoTranscodeJobData,
} from "@vetralink/shared-types";

export const VIDEO_TRANSCODE_QUEUE = "video-transcode";

export interface IVideoTranscodeQueueService {
  dispatchTranscodeJob(
    data: VideoTranscodeJobData
  ): Promise<{ jobId: string }>;

  getJobStatus(
    jobId: string
  ): Promise<TranscodeJobStatusResponseDto | null>;
}

export const VIDEO_TRANSCODE_QUEUE_SERVICE = "VIDEO_TRANSCODE_QUEUE_SERVICE";
