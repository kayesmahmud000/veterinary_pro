export enum MediaCategory {
  VIDEO_COURSE = "VIDEO_COURSE",
  EBOOK = "EBOOK",
  EXCEL_TOOL = "EXCEL_TOOL",
  THUMBNAIL = "THUMBNAIL",
  ATTACHMENT = "ATTACHMENT",
}

export interface InitiateMultipartUploadRequestDto {
  readonly filename: string;
  readonly contentType: string;
  readonly fileSizeBytes: number;
  readonly category: MediaCategory;
  readonly entityId?: string;
}

export interface InitiateMultipartUploadResponseDto {
  readonly uploadId: string;
  readonly key: string;
  readonly bucket: string;
  readonly partSizeBytes: number;
  readonly totalParts: number;
}

export interface GetPresignedPartUrlRequestDto {
  readonly uploadId: string;
  readonly key: string;
  readonly partNumber: number;
}

export interface GetPresignedPartUrlResponseDto {
  readonly url: string;
  readonly partNumber: number;
  readonly expiresInSeconds: number;
}

export interface MultipartPartETag {
  readonly partNumber: number;
  readonly etag: string;
}

export interface CompleteMultipartUploadRequestDto {
  readonly uploadId: string;
  readonly key: string;
  readonly parts: readonly MultipartPartETag[];
}

export interface CompleteMultipartUploadResponseDto {
  readonly location: string;
  readonly bucket: string;
  readonly key: string;
  readonly etag?: string;
}

export interface AbortMultipartUploadRequestDto {
  readonly uploadId: string;
  readonly key: string;
}

export interface DirectUploadRequestDto {
  readonly filename: string;
  readonly contentType: string;
  readonly fileSizeBytes: number;
  readonly category: MediaCategory;
  readonly entityId?: string;
}

export interface DirectUploadResponseDto {
  readonly uploadUrl: string;
  readonly key: string;
  readonly bucket: string;
  readonly expiresInSeconds: number;
}
