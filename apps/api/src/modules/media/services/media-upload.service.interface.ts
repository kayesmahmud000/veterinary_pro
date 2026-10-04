import {
  AbortMultipartUploadRequestDto,
  CompleteMultipartUploadRequestDto,
  CompleteMultipartUploadResponseDto,
  DirectUploadRequestDto,
  DirectUploadResponseDto,
  GetPresignedPartUrlRequestDto,
  GetPresignedPartUrlResponseDto,
  InitiateMultipartUploadRequestDto,
  InitiateMultipartUploadResponseDto,
} from "@vetralink/shared-types";

export interface IMediaUploadService {
  initiateMultipartUpload(
    dto: InitiateMultipartUploadRequestDto,
    userId: string
  ): Promise<InitiateMultipartUploadResponseDto>;

  getPresignedPartUrl(
    dto: GetPresignedPartUrlRequestDto
  ): Promise<GetPresignedPartUrlResponseDto>;

  completeMultipartUpload(
    dto: CompleteMultipartUploadRequestDto,
    userId: string
  ): Promise<CompleteMultipartUploadResponseDto>;

  abortMultipartUpload(
    dto: AbortMultipartUploadRequestDto,
    userId: string
  ): Promise<void>;

  generateDirectUploadUrl(
    dto: DirectUploadRequestDto,
    userId: string
  ): Promise<DirectUploadResponseDto>;
}

export const MEDIA_UPLOAD_SERVICE = "MEDIA_UPLOAD_SERVICE";
