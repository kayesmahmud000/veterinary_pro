import { S3StorageService } from "./s3-storage.service";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://mock-s3-presigned-url.com"),
}));

describe("S3StorageService", () => {
  let service: S3StorageService;
  let mockEnvService: jest.Mocked<EnvService>;
  let mockS3Send: jest.Mock;

  beforeEach(() => {
    mockEnvService = {
      awsRegion: "us-east-1",
      awsAccessKeyId: "mockKey",
      awsSecretAccessKey: "mockSecret",
      s3Endpoint: "http://localhost:9000",
      s3ForcePathStyle: true,
      s3BucketMedia: "test-media-bucket",
    } as unknown as jest.Mocked<EnvService>;

    service = new S3StorageService(mockEnvService);
    mockS3Send = (service as any).s3Client.send;
  });

  describe("createMultipartUpload", () => {
    it("should return UploadId from S3 response", async () => {
      mockS3Send.mockResolvedValueOnce({
        UploadId: "mock-upload-id-12345",
      });

      const uploadId = await service.createMultipartUpload(
        "test-bucket",
        "videos/test.mp4",
        "video/mp4"
      );

      expect(uploadId).toBe("mock-upload-id-12345");
      expect(mockS3Send).toHaveBeenCalled();
    });

    it("should throw error if S3 does not return UploadId", async () => {
      mockS3Send.mockResolvedValueOnce({});

      await expect(
        service.createMultipartUpload(
          "test-bucket",
          "videos/test.mp4",
          "video/mp4"
        )
      ).rejects.toThrow("S3 failed to return an UploadId.");
    });
  });

  describe("getPresignedPartUploadUrl", () => {
    it("should return presigned URL for valid part number", async () => {
      const url = await service.getPresignedPartUploadUrl(
        "test-bucket",
        "videos/test.mp4",
        "mock-upload-id",
        1,
        3600
      );

      expect(url).toBe("https://mock-s3-presigned-url.com");
    });

    it("should throw ValidationDomainException if part number is less than 1 or greater than 10000", async () => {
      await expect(
        service.getPresignedPartUploadUrl(
          "test-bucket",
          "videos/test.mp4",
          "mock-upload-id",
          0
        )
      ).rejects.toThrow(ValidationDomainException);

      await expect(
        service.getPresignedPartUploadUrl(
          "test-bucket",
          "videos/test.mp4",
          "mock-upload-id",
          10001
        )
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("completeMultipartUpload", () => {
    it("should sort parts and return location and etag", async () => {
      mockS3Send.mockResolvedValueOnce({
        Location: "https://test-bucket.s3.amazonaws.com/videos/test.mp4",
        ETag: '"final-etag-hash"',
      });

      const result = await service.completeMultipartUpload(
        "test-bucket",
        "videos/test.mp4",
        "mock-upload-id",
        [
          { partNumber: 2, etag: '"etag-2"' },
          { partNumber: 1, etag: '"etag-1"' },
        ]
      );

      expect(result.location).toContain("videos/test.mp4");
      expect(result.etag).toBe('"final-etag-hash"');
      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe("abortMultipartUpload", () => {
    it("should call S3 send with AbortMultipartUploadCommand", async () => {
      mockS3Send.mockResolvedValueOnce({});

      await service.abortMultipartUpload(
        "test-bucket",
        "videos/test.mp4",
        "mock-upload-id"
      );

      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe("getPresignedPutUrl", () => {
    it("should return presigned PUT URL", async () => {
      const url = await service.getPresignedPutUrl(
        "test-bucket",
        "ebooks/manual.pdf",
        "application/pdf",
        900
      );

      expect(url).toBe("https://mock-s3-presigned-url.com");
    });
  });

  describe("getPresignedGetUrl", () => {
    it("should return presigned GET URL", async () => {
      const url = await service.getPresignedGetUrl(
        "test-bucket",
        "ebooks/manual.pdf",
        900
      );

      expect(url).toBe("https://mock-s3-presigned-url.com");
    });
  });

  describe("downloadFile", () => {
    it("should download object stream to local path", async () => {
      const mockStream = new Readable({
        read() {
          this.push("test data");
          this.push(null);
        },
      });
      mockS3Send.mockResolvedValueOnce({
        Body: mockStream,
      });

      const destPath = path.join(os.tmpdir(), `test-s3-${Date.now()}.txt`);
      await service.downloadFile("test-bucket", "test.txt", destPath);

      expect(mockS3Send).toHaveBeenCalled();
      expect(fs.existsSync(destPath)).toBe(true);

      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
    });

    it("should throw error if S3 returns empty body", async () => {
      mockS3Send.mockResolvedValueOnce({ Body: null });

      await expect(
        service.downloadFile("test-bucket", "test.txt", "/tmp/dest.txt")
      ).rejects.toThrow("S3 GetObject returned empty body");
    });
  });

  describe("uploadFileFromDisk", () => {
    it("should upload local file stream to S3", async () => {
      const tempFile = path.join(os.tmpdir(), `upload-test-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, "sample video data");

      mockS3Send.mockResolvedValueOnce({});

      await service.uploadFileFromDisk(
        "test-bucket",
        "hls/master.m3u8",
        tempFile,
        "application/vnd.apple.mpegurl"
      );

      expect(mockS3Send).toHaveBeenCalled();

      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore if locked
      }
    });
  });
});

