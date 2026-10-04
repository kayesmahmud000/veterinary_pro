export interface WatermarkJobData {
  readonly orderId: string;
  readonly orderItemId: string;
  readonly productId: string;
  readonly userId: string;
  readonly downloadToken: string;
  readonly sourceBucket?: string;
  readonly sourceS3Key: string;
  readonly destinationBucket?: string;
  readonly destinationS3Key: string;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly purchaseDate: string;
}

export interface WatermarkJobResult {
  readonly orderId: string;
  readonly orderItemId: string;
  readonly destinationS3Key: string;
  readonly pageCount: number;
  readonly fileSizeBytes: number;
  readonly executionTimeMs: number;
  readonly completedAt: string;
}

export enum WatermarkJobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
