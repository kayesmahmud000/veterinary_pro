export interface RequestAttachmentPresignedUrlDto {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly caption?: string;
}
