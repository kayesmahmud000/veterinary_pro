export interface MultipartPartInput {
  partNumber: number;
  etag: string;
}

export interface IS3StorageService {
  createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Promise<string>;

  getPresignedPartUploadUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds?: number
  ): Promise<string>;

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: MultipartPartInput[]
  ): Promise<{ location: string; etag?: string }>;

  abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void>;

  getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds?: number
  ): Promise<string>;

  getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds?: number
  ): Promise<string>;
}

export const S3_STORAGE_SERVICE = "S3_STORAGE_SERVICE";
