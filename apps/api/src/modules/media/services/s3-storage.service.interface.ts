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

  downloadFile(
    bucket: string,
    key: string,
    localDestinationPath: string
  ): Promise<void>;

  uploadFileFromDisk(
    bucket: string,
    key: string,
    localFilePath: string,
    contentType: string
  ): Promise<void>;

  uploadBuffer?(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void>;

  deleteObject(bucket: string, key: string): Promise<void>;
}

export const S3_STORAGE_SERVICE = "S3_STORAGE_SERVICE";
