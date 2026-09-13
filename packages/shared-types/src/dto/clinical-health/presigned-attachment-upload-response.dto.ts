export interface PresignedAttachmentUploadResponseDto {
  readonly attachmentId: string;
  readonly uploadUrl: string;
  readonly s3Key: string;
  readonly expiresInSeconds: number;
}
