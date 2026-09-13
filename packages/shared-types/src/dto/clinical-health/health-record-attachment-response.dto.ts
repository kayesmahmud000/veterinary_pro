import { HealthAttachmentStatus } from "../../enums/health-attachment-status.enum.js";

export interface HealthRecordAttachmentResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly healthRecordId: string;
  readonly uploadedById: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly mimeType: string;
  readonly s3Key: string;
  readonly status: HealthAttachmentStatus;
  readonly caption: string | null;
  readonly viewUrl?: string;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
