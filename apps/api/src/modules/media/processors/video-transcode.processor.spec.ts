import { Job } from "bullmq";
import {
  ProductType,
  SubscriptionTier,
  TranscodeStatus,
  VideoTranscodeJobData,
  VideoTranscodeResultDto,
} from "@vetralink/shared-types";
import { VideoTranscodeProcessor } from "./video-transcode.processor";
import { IS3StorageService } from "../services/s3-storage.service.interface";
import { IVideoTranscoderService } from "../services/video-transcoder.service.interface";
import { IProductRepository } from "../../products/repositories/product.repository.interface";
import { ProductEntity } from "../../products/entities/product.entity";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("VideoTranscodeProcessor", () => {
  let processor: VideoTranscodeProcessor;
  let mockS3Storage: jest.Mocked<IS3StorageService>;
  let mockVideoTranscoder: jest.Mocked<IVideoTranscoderService>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockEnvService: jest.Mocked<EnvService>;
  let mockJob: jest.Mocked<Job<VideoTranscodeJobData, VideoTranscodeResultDto>>;

  const mockProduct = ProductEntity.create({
    id: "prod-1111-1111-1111-111111111111",
    title: "Mastitis Surgery Masterclass",
    slug: "mastitis-surgery-masterclass",
    type: ProductType.VIDEO_COURSE,
    description: "Clinical guide to surgical procedures for dairy bovine mastitis.",
    priceCents: 4999,
    contentS3Key: "raw-videos/prod-1111/master.mp4",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
  });

  const jobData: VideoTranscodeJobData = {
    productId: "prod-1111-1111-1111-111111111111",
    rawS3Key: "raw-videos/prod-1111/master.mp4",
    bucket: "vetralink-media",
    requestedBy: "vet-user-1",
  };

  beforeEach(() => {
    mockS3Storage = {
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      getPresignedPutUrl: jest.fn(),
      getPresignedGetUrl: jest.fn(),
      downloadFile: jest.fn().mockResolvedValue(undefined),
      uploadFileFromDisk: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn(),
    };

    mockVideoTranscoder = {
      probeVideo: jest.fn(),
      transcodeToHls: jest.fn().mockResolvedValue({
        masterPlaylistPath: "/tmp/master.m3u8",
        resolutions: ["1080p", "720p", "480p", "360p"],
        durationSeconds: 120,
        generatedFiles: [
          "master.m3u8",
          "1080p/index.m3u8",
          "1080p/segment_000.ts",
          "720p/index.m3u8",
          "720p/segment_000.ts",
        ],
        totalSizeBytes: 15000000,
      }),
    };

    mockProductRepository = {
      update: jest.fn().mockResolvedValue(mockProduct),
      findById: jest.fn().mockResolvedValue(mockProduct),
      create: jest.fn(),
      findBySlug: jest.fn(),
      findMany: jest.fn(),
      softDelete: jest.fn(),
      existsBySlug: jest.fn(),
    };

    mockEnvService = {
      s3BucketMedia: "vetralink-media",
    } as unknown as jest.Mocked<EnvService>;

    mockJob = {
      id: "transcode-job-123",
      data: jobData,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Job<VideoTranscodeJobData, VideoTranscodeResultDto>>;

    processor = new VideoTranscodeProcessor(
      mockS3Storage,
      mockVideoTranscoder,
      mockProductRepository,
      mockEnvService
    );
  });

  describe("process", () => {
    it("should throw ValidationDomainException if product is not found", async () => {
      mockProductRepository.findById.mockResolvedValueOnce(null);

      await expect(processor.process(mockJob)).rejects.toThrow(
        ValidationDomainException
      );
      expect(mockS3Storage.downloadFile).not.toHaveBeenCalled();
    });

    it("should execute download, transcode, upload, and update product on success", async () => {
      const result = await processor.process(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(5);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(70);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(90);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

      // Verify S3 download called
      expect(mockS3Storage.downloadFile).toHaveBeenCalledWith(
        "vetralink-media",
        "raw-videos/prod-1111/master.mp4",
        expect.stringContaining("master_source.mp4")
      );

      // Verify transcode called
      expect(mockVideoTranscoder.transcodeToHls).toHaveBeenCalled();

      // Verify S3 uploads called for master and variants
      expect(mockS3Storage.uploadFileFromDisk).toHaveBeenCalledWith(
        "vetralink-media",
        "hls/prod-1111-1111-1111-111111111111/master.m3u8",
        expect.any(String),
        "application/vnd.apple.mpegurl"
      );
      expect(mockS3Storage.uploadFileFromDisk).toHaveBeenCalledWith(
        "vetralink-media",
        "hls/prod-1111-1111-1111-111111111111/1080p/segment_000.ts",
        expect.any(String),
        "video/MP2T"
      );

      // Verify product updated with HLS master and metadata
      expect(mockProductRepository.update).toHaveBeenCalled();
      expect(mockProduct.contentS3Key).toBe(
        "hls/prod-1111-1111-1111-111111111111/master.m3u8"
      );
      expect(mockProduct.metadata).toMatchObject({
        durationSeconds: 120,
        resolutions: ["1080p", "720p", "480p", "360p"],
        hlsMasterKey: "hls/prod-1111-1111-1111-111111111111/master.m3u8",
        transcodeStatus: TranscodeStatus.COMPLETED,
        sourceMasterKey: "raw-videos/prod-1111/master.mp4",
      });

      // Verify return payload
      expect(result).toEqual({
        productId: "prod-1111-1111-1111-111111111111",
        masterPlaylistS3Key: "hls/prod-1111-1111-1111-111111111111/master.m3u8",
        durationSeconds: 120,
        resolutions: ["1080p", "720p", "480p", "360p"],
        segmentCount: 2,
        totalSizeBytes: 15000000,
      });
    });

    it("should update product with FAILED status and rethrow when transcoding fails", async () => {
      mockVideoTranscoder.transcodeToHls.mockRejectedValueOnce(
        new Error("FFmpeg segmentation failed")
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        "FFmpeg segmentation failed"
      );

      expect(mockProduct.metadata).toMatchObject({
        transcodeStatus: TranscodeStatus.FAILED,
        transcodeError: "FFmpeg segmentation failed",
      });
      expect(mockProductRepository.update).toHaveBeenCalled();
    });
  });
});
