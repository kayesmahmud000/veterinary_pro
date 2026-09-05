import { MediaCategory } from "@vetralink/shared-types";
import { MediaUploadService } from "./media-upload.service";
import { IS3StorageService } from "./s3-storage.service.interface";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("MediaUploadService", () => {
  let service: MediaUploadService;
  let s3Storage: jest.Mocked<IS3StorageService>;
  let envService: jest.Mocked<EnvService>;

  beforeEach(() => {
    s3Storage = {
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      getPresignedPutUrl: jest.fn(),
      getPresignedGetUrl: jest.fn(),
      downloadFile: jest.fn(),
      uploadFileFromDisk: jest.fn(),
    };

    envService = {
      s3BucketMedia: "vetralink-media-test",
    } as unknown as jest.Mocked<EnvService>;

    service = new MediaUploadService(s3Storage, envService);
  });

  describe("initiateMultipartUpload", () => {
    const validVideoDto = {
      filename: "lecture-1.mp4",
      contentType: "video/mp4",
      fileSizeBytes: 52428800, // 50MB
      category: MediaCategory.VIDEO_COURSE,
      entityId: "prod-1111",
    };

    it("should initiate upload and calculate chunks accurately", async () => {
      s3Storage.createMultipartUpload.mockResolvedValueOnce("s3-upload-12345");

      const result = await service.initiateMultipartUpload(
        validVideoDto,
        "user-vet-1"
      );

      expect(result.uploadId).toBe("s3-upload-12345");
      expect(result.bucket).toBe("vetralink-media-test");
      expect(result.key).toMatch(/^raw-videos\/prod-1111\/\d+-[a-f0-9-]+\.mp4$/);
      expect(result.partSizeBytes).toBe(10 * 1024 * 1024); // 10MB
      expect(result.totalParts).toBe(5); // 50MB / 10MB = 5 parts
      expect(s3Storage.createMultipartUpload).toHaveBeenCalled();
    });

    it("should throw ValidationDomainException if file extension is not allowed", async () => {
      await expect(
        service.initiateMultipartUpload(
          {
            ...validVideoDto,
            filename: "exploit.exe",
          },
          "user-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if MIME content-type is disallowed", async () => {
      await expect(
        service.initiateMultipartUpload(
          {
            ...validVideoDto,
            contentType: "application/x-msdownload",
          },
          "user-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if video size is below minimum 5MB", async () => {
      await expect(
        service.initiateMultipartUpload(
          {
            ...validVideoDto,
            fileSizeBytes: 1024 * 1024, // 1MB < 5MB
          },
          "user-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if video size exceeds 10GB limit", async () => {
      await expect(
        service.initiateMultipartUpload(
          {
            ...validVideoDto,
            fileSizeBytes: 11 * 1024 * 1024 * 1024, // 11GB > 10GB
          },
          "user-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getPresignedPartUrl", () => {
    it("should delegate to s3Storage and return url with partNumber", async () => {
      s3Storage.getPresignedPartUploadUrl.mockResolvedValueOnce(
        "https://s3.amazonaws.com/part-1-url"
      );

      const result = await service.getPresignedPartUrl({
        uploadId: "upload-123",
        key: "raw-videos/lecture.mp4",
        partNumber: 1,
      });

      expect(result.url).toBe("https://s3.amazonaws.com/part-1-url");
      expect(result.partNumber).toBe(1);
      expect(result.expiresInSeconds).toBe(3600);
    });
  });

  describe("completeMultipartUpload", () => {
    it("should assemble parts and return final S3 location", async () => {
      s3Storage.completeMultipartUpload.mockResolvedValueOnce({
        location: "https://s3.amazonaws.com/raw-videos/lecture.mp4",
        etag: '"combined-etag"',
      });

      const result = await service.completeMultipartUpload(
        {
          uploadId: "upload-123",
          key: "raw-videos/lecture.mp4",
          parts: [{ partNumber: 1, etag: '"etag-1"' }],
        },
        "user-vet-1"
      );

      expect(result.location).toBe("https://s3.amazonaws.com/raw-videos/lecture.mp4");
      expect(result.etag).toBe('"combined-etag"');
      expect(s3Storage.completeMultipartUpload).toHaveBeenCalled();
    });

    it("should automatically dispatch transcode job when raw-video upload completes", async () => {
      const mockQueue = {
        dispatchTranscodeJob: jest.fn().mockResolvedValue({ jobId: "job-1" }),
        getJobStatus: jest.fn(),
      };
      const serviceWithQueue = new MediaUploadService(
        s3Storage,
        envService,
        mockQueue
      );

      s3Storage.completeMultipartUpload.mockResolvedValueOnce({
        location: "https://s3.amazonaws.com/raw-videos/prod-1111/lecture.mp4",
        etag: '"etag"',
      });

      await serviceWithQueue.completeMultipartUpload(
        {
          uploadId: "upload-123",
          key: "raw-videos/prod-1111/1725540000-uuid.mp4",
          parts: [{ partNumber: 1, etag: '"etag"' }],
        },
        "user-vet-1"
      );

      expect(mockQueue.dispatchTranscodeJob).toHaveBeenCalledWith({
        productId: "prod-1111",
        rawS3Key: "raw-videos/prod-1111/1725540000-uuid.mp4",
        bucket: "vetralink-media-test",
        requestedBy: "user-vet-1",
      });
    });

    it("should throw ValidationDomainException if parts array is empty", async () => {
      await expect(
        service.completeMultipartUpload(
          {
            uploadId: "upload-123",
            key: "raw-videos/lecture.mp4",
            parts: [],
          },
          "user-vet-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("abortMultipartUpload", () => {
    it("should delegate abort to s3Storage", async () => {
      s3Storage.abortMultipartUpload.mockResolvedValueOnce();

      await service.abortMultipartUpload(
        { uploadId: "upload-123", key: "raw-videos/lecture.mp4" },
        "user-vet-1"
      );

      expect(s3Storage.abortMultipartUpload).toHaveBeenCalledWith(
        "vetralink-media-test",
        "raw-videos/lecture.mp4",
        "upload-123"
      );
    });
  });

  describe("generateDirectUploadUrl", () => {
    it("should generate direct presigned PUT URL for ebook PDF", async () => {
      s3Storage.getPresignedPutUrl.mockResolvedValueOnce(
        "https://s3.amazonaws.com/direct-put-url"
      );

      const result = await service.generateDirectUploadUrl(
        {
          filename: "dairy-manual.pdf",
          contentType: "application/pdf",
          fileSizeBytes: 10485760, // 10MB
          category: MediaCategory.EBOOK,
        },
        "user-vet-1"
      );

      expect(result.uploadUrl).toBe("https://s3.amazonaws.com/direct-put-url");
      expect(result.key).toMatch(/^ebooks\/\d+-[a-f0-9-]+\.pdf$/);
      expect(result.expiresInSeconds).toBe(900);
    });

    it("should reject thumbnail exceeding 10MB", async () => {
      await expect(
        service.generateDirectUploadUrl(
          {
            filename: "poster.jpg",
            contentType: "image/jpeg",
            fileSizeBytes: 15 * 1024 * 1024, // 15MB > 10MB
            category: MediaCategory.THUMBNAIL,
          },
          "user-1"
        )
      ).rejects.toThrow(ValidationDomainException);
    });
  });
});
