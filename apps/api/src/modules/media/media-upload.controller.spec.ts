import { Test, TestingModule } from "@nestjs/testing";
import {
  JwtPayload,
  MediaCategory,
  TranscodeStatus,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { MediaUploadController } from "./media-upload.controller";
import {
  IMediaUploadService,
  MEDIA_UPLOAD_SERVICE,
} from "./services/media-upload.service.interface";
import {
  IVideoTranscodeQueueService,
  VIDEO_TRANSCODE_QUEUE_SERVICE,
} from "./services/video-transcode-queue.service.interface";
import { EnvService } from "../../config/env.service";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { EntityNotFoundException } from "../../common/exceptions/domain.exception";

describe("MediaUploadController", () => {
  let controller: MediaUploadController;
  let mockMediaUploadService: jest.Mocked<IMediaUploadService>;
  let mockTranscodeQueueService: jest.Mocked<IVideoTranscodeQueueService>;
  let mockEnvService: jest.Mocked<EnvService>;

  const mockUser: JwtPayload = {
    sub: "user-vet-123",
    email: "vet@vetralink.internal",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    mockMediaUploadService = {
      initiateMultipartUpload: jest.fn(),
      getPresignedPartUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      generateDirectUploadUrl: jest.fn(),
    };

    mockTranscodeQueueService = {
      dispatchTranscodeJob: jest.fn(),
      getJobStatus: jest.fn(),
    };

    mockEnvService = {
      s3BucketMedia: "test-media-bucket",
    } as unknown as jest.Mocked<EnvService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaUploadController],
      providers: [
        {
          provide: MEDIA_UPLOAD_SERVICE,
          useValue: mockMediaUploadService,
        },
        {
          provide: VIDEO_TRANSCODE_QUEUE_SERVICE,
          useValue: mockTranscodeQueueService,
        },
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<MediaUploadController>(MediaUploadController);
  });

  describe("initiateMultipartUpload", () => {
    it("should delegate to mediaUploadService and return initiation payload", async () => {
      const dto = {
        filename: "mastitis-surgery.mp4",
        contentType: "video/mp4",
        fileSizeBytes: 104857600,
        category: MediaCategory.VIDEO_COURSE,
        entityId: "prod-1",
      };

      const expectedResponse = {
        uploadId: "s3-upload-123",
        key: "raw-videos/prod-1/test.mp4",
        bucket: "test-bucket",
        partSizeBytes: 10485760,
        totalParts: 10,
      };

      mockMediaUploadService.initiateMultipartUpload.mockResolvedValue(
        expectedResponse
      );

      const result = await controller.initiateMultipartUpload(dto, mockUser);

      expect(mockMediaUploadService.initiateMultipartUpload).toHaveBeenCalledWith(
        dto,
        mockUser.sub
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("getPresignedPartUrl", () => {
    it("should delegate to mediaUploadService and return presigned part url", async () => {
      const dto = {
        uploadId: "s3-upload-123",
        key: "raw-videos/test.mp4",
        partNumber: 2,
      };

      const expectedResponse = {
        url: "https://s3.amazonaws.com/part-2-presigned",
        partNumber: 2,
        expiresInSeconds: 3600,
      };

      mockMediaUploadService.getPresignedPartUrl.mockResolvedValue(
        expectedResponse
      );

      const result = await controller.getPresignedPartUrl(dto);

      expect(mockMediaUploadService.getPresignedPartUrl).toHaveBeenCalledWith(
        dto
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("completeMultipartUpload", () => {
    it("should delegate to mediaUploadService and return completed object metadata", async () => {
      const dto = {
        uploadId: "s3-upload-123",
        key: "raw-videos/test.mp4",
        parts: [{ partNumber: 1, etag: '"etag-1"' }],
      };

      const expectedResponse = {
        location: "https://test-bucket.s3.amazonaws.com/raw-videos/test.mp4",
        bucket: "test-bucket",
        key: "raw-videos/test.mp4",
        etag: '"etag-1"',
      };

      mockMediaUploadService.completeMultipartUpload.mockResolvedValue(
        expectedResponse
      );

      const result = await controller.completeMultipartUpload(dto, mockUser);

      expect(mockMediaUploadService.completeMultipartUpload).toHaveBeenCalledWith(
        dto,
        mockUser.sub
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("abortMultipartUpload", () => {
    it("should delegate abort to mediaUploadService and return aborted status", async () => {
      const dto = {
        uploadId: "s3-upload-123",
        key: "raw-videos/test.mp4",
      };

      mockMediaUploadService.abortMultipartUpload.mockResolvedValue(undefined);

      const result = await controller.abortMultipartUpload(dto, mockUser);

      expect(mockMediaUploadService.abortMultipartUpload).toHaveBeenCalledWith(
        dto,
        mockUser.sub
      );
      expect(result).toEqual({ aborted: true });
    });
  });

  describe("generateDirectUploadUrl", () => {
    it("should delegate to mediaUploadService and return direct upload url", async () => {
      const dto = {
        filename: "manual.pdf",
        contentType: "application/pdf",
        fileSizeBytes: 5242880,
        category: MediaCategory.EBOOK,
      };

      const expectedResponse = {
        uploadUrl: "https://s3.amazonaws.com/put-presigned",
        key: "ebooks/manual.pdf",
        bucket: "test-bucket",
        expiresInSeconds: 900,
      };

      mockMediaUploadService.generateDirectUploadUrl.mockResolvedValue(
        expectedResponse
      );

      const result = await controller.generateDirectUploadUrl(dto, mockUser);

      expect(mockMediaUploadService.generateDirectUploadUrl).toHaveBeenCalledWith(
        dto,
        mockUser.sub
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("queueTranscode", () => {
    it("should delegate to transcodeQueueService and return accepted payload", async () => {
      const dto = {
        productId: "prod-1111-1111-1111-111111111111",
        rawS3Key: "raw-videos/prod-1111/master.mp4",
      };

      mockTranscodeQueueService.dispatchTranscodeJob.mockResolvedValueOnce({
        jobId: "transcode-prod-1111-12345",
      });

      const result = await controller.queueTranscode(dto, mockUser);

      expect(mockTranscodeQueueService.dispatchTranscodeJob).toHaveBeenCalledWith({
        productId: dto.productId,
        rawS3Key: dto.rawS3Key,
        bucket: "test-media-bucket",
        requestedBy: mockUser.sub,
      });
      expect(result).toEqual({
        jobId: "transcode-prod-1111-12345",
        productId: dto.productId,
        status: TranscodeStatus.PENDING,
      });
    });
  });

  describe("getTranscodeStatus", () => {
    it("should return job status when job exists", async () => {
      const mockStatus = {
        jobId: "transcode-123",
        state: "active" as const,
        progress: 50,
        data: {
          productId: "prod-1",
          rawS3Key: "raw-videos/master.mp4",
          bucket: "test-bucket",
          requestedBy: "vet-1",
        },
      };

      mockTranscodeQueueService.getJobStatus.mockResolvedValueOnce(mockStatus);

      const result = await controller.getTranscodeStatus("transcode-123");

      expect(mockTranscodeQueueService.getJobStatus).toHaveBeenCalledWith(
        "transcode-123"
      );
      expect(result).toEqual(mockStatus);
    });

    it("should throw EntityNotFoundException when job does not exist", async () => {
      mockTranscodeQueueService.getJobStatus.mockResolvedValueOnce(null);

      await expect(
        controller.getTranscodeStatus("non-existent-job")
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});

