export enum TranscodeStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface VideoTranscodeJobData {
  readonly productId: string;
  readonly rawS3Key: string;
  readonly bucket: string;
  readonly outputPrefix?: string;
  readonly requestedBy: string;
}

export interface VideoTranscodeResultDto {
  readonly productId: string;
  readonly masterPlaylistS3Key: string;
  readonly durationSeconds: number;
  readonly resolutions: readonly string[];
  readonly segmentCount: number;
  readonly totalSizeBytes: number;
}

export type TranscodeJobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "unknown";

export interface TranscodeJobStatusResponseDto {
  readonly jobId: string;
  readonly state: TranscodeJobState;
  readonly progress: number; // 0 - 100
  readonly data: VideoTranscodeJobData;
  readonly result?: VideoTranscodeResultDto;
  readonly failedReason?: string;
}

export interface QueueTranscodeRequestDto {
  readonly productId: string;
  readonly rawS3Key: string;
}

export interface QueueTranscodeResponseDto {
  readonly jobId: string;
  readonly productId: string;
  readonly status: TranscodeStatus;
}

export interface ProductVideoMetadata {
  readonly durationSeconds?: number;
  readonly resolutions?: readonly string[];
  readonly hlsMasterKey?: string;
  readonly transcodeStatus?: TranscodeStatus;
  readonly transcodeError?: string;
  readonly transcodedAt?: string;
  readonly sourceMasterKey?: string;
}
