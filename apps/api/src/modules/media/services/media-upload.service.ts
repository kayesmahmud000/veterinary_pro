import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
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
  MediaCategory,
} from "@vetralink/shared-types";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "./s3-storage.service.interface";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { IMediaUploadService } from "./media-upload.service.interface";

interface CategoryPolicy {
  allowedMimes: string[];
  allowedExtensions: string[];
  folder: string;
  minBytes?: number;
  maxBytes: number;
}

const CATEGORY_POLICIES: Record<MediaCategory, CategoryPolicy> = {
  [MediaCategory.VIDEO_COURSE]: {
    allowedMimes: ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
    allowedExtensions: [".mp4", ".mov", ".mkv", ".webm"],
    folder: "raw-videos",
    minBytes: 5 * 1024 * 1024, // 5MB min for multipart video
    maxBytes: 10 * 1024 * 1024 * 1024, // 10GB max
  },
  [MediaCategory.EBOOK]: {
    allowedMimes: ["application/pdf", "application/epub+zip"],
    allowedExtensions: [".pdf", ".epub"],
    folder: "ebooks",
    maxBytes: 150 * 1024 * 1024, // 150MB max
  },
  [MediaCategory.EXCEL_TOOL]: {
    allowedMimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    allowedExtensions: [".xlsx", ".xls"],
    folder: "tools",
    maxBytes: 50 * 1024 * 1024, // 50MB max
  },
  [MediaCategory.THUMBNAIL]: {
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    folder: "thumbnails",
    maxBytes: 10 * 1024 * 1024, // 10MB max
  },
  [MediaCategory.ATTACHMENT]: {
    allowedMimes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".xlsx"],
    folder: "attachments",
    maxBytes: 50 * 1024 * 1024, // 50MB max
  },
};

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10MB default chunk

@Injectable()
export class MediaUploadService implements IMediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);

  constructor(
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3Storage: IS3StorageService,
    private readonly envService: EnvService
  ) {}

  public async initiateMultipartUpload(
    dto: InitiateMultipartUploadRequestDto,
    userId: string
  ): Promise<InitiateMultipartUploadResponseDto> {
    this.validateUploadRequest(dto.filename, dto.contentType, dto.fileSizeBytes, dto.category);

    const bucket = this.envService.s3BucketMedia;
    const key = this.generateS3Key(dto.filename, dto.category, dto.entityId);

    // Compute optimal chunk size ensuring parts <= 10,000
    let partSizeBytes = DEFAULT_PART_SIZE;
    let totalParts = Math.ceil(dto.fileSizeBytes / partSizeBytes);

    if (totalParts > 10000) {
      partSizeBytes = Math.ceil(dto.fileSizeBytes / 10000);
      totalParts = Math.ceil(dto.fileSizeBytes / partSizeBytes);
    }

    const uploadId = await this.s3Storage.createMultipartUpload(
      bucket,
      key,
      dto.contentType
    );

    this.logger.log(
      `User [${userId}] initiated multipart upload for '${dto.filename}' [${uploadId}] -> key: '${key}', parts: ${totalParts}`
    );

    return {
      uploadId,
      key,
      bucket,
      partSizeBytes,
      totalParts,
    };
  }

  public async getPresignedPartUrl(
    dto: GetPresignedPartUrlRequestDto
  ): Promise<GetPresignedPartUrlResponseDto> {
    const bucket = this.envService.s3BucketMedia;
    const expiresInSeconds = 3600; // 1 hour validity per part

    const url = await this.s3Storage.getPresignedPartUploadUrl(
      bucket,
      dto.key,
      dto.uploadId,
      dto.partNumber,
      expiresInSeconds
    );

    return {
      url,
      partNumber: dto.partNumber,
      expiresInSeconds,
    };
  }

  public async completeMultipartUpload(
    dto: CompleteMultipartUploadRequestDto,
    userId: string
  ): Promise<CompleteMultipartUploadResponseDto> {
    if (!dto.parts || dto.parts.length === 0) {
      throw new ValidationDomainException(
        "Cannot complete multipart upload without parts."
      );
    }

    const bucket = this.envService.s3BucketMedia;

    const result = await this.s3Storage.completeMultipartUpload(
      bucket,
      dto.key,
      dto.uploadId,
      [...dto.parts]
    );

    this.logger.log(
      `User [${userId}] completed multipart upload on '${dto.key}' [${dto.uploadId}]`
    );

    return {
      location: result.location,
      bucket,
      key: dto.key,
      etag: result.etag,
    };
  }

  public async abortMultipartUpload(
    dto: AbortMultipartUploadRequestDto,
    userId: string
  ): Promise<void> {
    const bucket = this.envService.s3BucketMedia;
    await this.s3Storage.abortMultipartUpload(bucket, dto.key, dto.uploadId);
    this.logger.log(`User [${userId}] aborted multipart upload '${dto.key}' [${dto.uploadId}]`);
  }

  public async generateDirectUploadUrl(
    dto: DirectUploadRequestDto,
    userId: string
  ): Promise<DirectUploadResponseDto> {
    this.validateUploadRequest(dto.filename, dto.contentType, dto.fileSizeBytes, dto.category);

    const bucket = this.envService.s3BucketMedia;
    const key = this.generateS3Key(dto.filename, dto.category, dto.entityId);
    const expiresInSeconds = 900; // 15 minutes

    const uploadUrl = await this.s3Storage.getPresignedPutUrl(
      bucket,
      key,
      dto.contentType,
      expiresInSeconds
    );

    this.logger.log(
      `User [${userId}] generated direct presigned PUT URL for '${dto.filename}' -> key: '${key}'`
    );

    return {
      uploadUrl,
      key,
      bucket,
      expiresInSeconds,
    };
  }

  private validateUploadRequest(
    filename: string,
    contentType: string,
    fileSizeBytes: number,
    category: MediaCategory
  ): void {
    const policy = CATEGORY_POLICIES[category];
    if (!policy) {
      throw new ValidationDomainException(
        `Unsupported media upload category: '${category}'.`
      );
    }

    const ext = extname(filename).toLowerCase();
    if (!policy.allowedExtensions.includes(ext)) {
      throw new ValidationDomainException(
        `File extension '${ext}' is not permitted for category '${category}'. Allowed: ${policy.allowedExtensions.join(", ")}`
      );
    }

    if (!policy.allowedMimes.includes(contentType.toLowerCase())) {
      throw new ValidationDomainException(
        `MIME content-type '${contentType}' is not permitted for category '${category}'. Allowed: ${policy.allowedMimes.join(", ")}`
      );
    }

    if (policy.minBytes !== undefined && fileSizeBytes < policy.minBytes) {
      throw new ValidationDomainException(
        `File size (${fileSizeBytes} bytes) is below the minimum required for '${category}' (${policy.minBytes} bytes).`
      );
    }

    if (fileSizeBytes > policy.maxBytes) {
      throw new ValidationDomainException(
        `File size (${fileSizeBytes} bytes) exceeds the maximum limit for '${category}' (${policy.maxBytes} bytes).`
      );
    }
  }

  private generateS3Key(
    filename: string,
    category: MediaCategory,
    entityId?: string
  ): string {
    const policy = CATEGORY_POLICIES[category];
    const ext = extname(filename).toLowerCase();
    const timestamp = Date.now();
    const uniqueId = randomUUID();

    const entityPrefix = entityId ? `${entityId}/` : "";
    return `${policy.folder}/${entityPrefix}${timestamp}-${uniqueId}${ext}`;
  }
}
