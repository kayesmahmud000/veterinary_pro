import {
  ConfirmAttachmentUploadDto,
  HealthRecordAttachmentResponseDto,
  PresignedAttachmentUploadResponseDto,
  RequestAttachmentPresignedUrlDto,
} from "@vetralink/shared-types";

export interface IHealthAttachmentService {
  generateUploadPresignedUrl(
    farmId: string,
    healthRecordId: string,
    userId: string,
    dto: RequestAttachmentPresignedUrlDto
  ): Promise<PresignedAttachmentUploadResponseDto>;

  confirmUpload(
    farmId: string,
    healthRecordId: string,
    attachmentId: string,
    dto?: ConfirmAttachmentUploadDto
  ): Promise<HealthRecordAttachmentResponseDto>;

  listAttachments(
    farmId: string,
    healthRecordId: string
  ): Promise<HealthRecordAttachmentResponseDto[]>;

  getAttachmentViewUrl(
    farmId: string,
    healthRecordId: string,
    attachmentId: string
  ): Promise<HealthRecordAttachmentResponseDto>;

  deleteAttachment(
    farmId: string,
    healthRecordId: string,
    attachmentId: string,
    userId: string,
    traceId?: string
  ): Promise<void>;
}

export const HEALTH_ATTACHMENT_SERVICE = "HEALTH_ATTACHMENT_SERVICE";
