import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TranscodeStatus,
  VideoTranscodeJobData,
  VideoTranscodeResultDto,
} from "@vetralink/shared-types";
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from "../../products/repositories/product.repository.interface";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../services/s3-storage.service.interface";
import {
  IVideoTranscoderService,
  VIDEO_TRANSCODER_SERVICE,
} from "../services/video-transcoder.service.interface";
import { VIDEO_TRANSCODE_QUEUE } from "../services/video-transcode-queue.service.interface";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
@Processor(VIDEO_TRANSCODE_QUEUE)
export class VideoTranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoTranscodeProcessor.name);

  constructor(
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3Storage: IS3StorageService,
    @Inject(VIDEO_TRANSCODER_SERVICE)
    private readonly videoTranscoder: IVideoTranscoderService,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    private readonly envService: EnvService
  ) {
    super();
  }

  public async process(
    job: Job<VideoTranscodeJobData, VideoTranscodeResultDto>
  ): Promise<VideoTranscodeResultDto> {
    const { productId, rawS3Key, bucket } = job.data;
    this.logger.log(
      `Starting video transcode job [${job.id}] for product [${productId}] -> S3: ${bucket}/${rawS3Key}`
    );

    await job.updateProgress(5);

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ValidationDomainException(
        `Cannot transcode video: Product [${productId}] not found in catalog.`
      );
    }

    product.updateDetails({
      metadata: {
        ...product.metadata,
        transcodeStatus: TranscodeStatus.PROCESSING,
      },
    });
    await this.productRepository.update(product);

    const tempDir = join(
      tmpdir(),
      `vetralink-transcode-${job.id || "job"}-${randomUUID()}`
    );
    await mkdir(tempDir, { recursive: true });

    try {
      // 1. Download raw master video from S3
      await job.updateProgress(10);
      const localRawVideo = join(tempDir, "master_source.mp4");
      await this.s3Storage.downloadFile(bucket, rawS3Key, localRawVideo);

      // 2. Execute ABR HLS Transcoding via FFmpeg
      await job.updateProgress(25);
      const hlsOutputDir = join(tempDir, "hls_output");
      await mkdir(hlsOutputDir, { recursive: true });

      const transcodeResult = await this.videoTranscoder.transcodeToHls({
        inputFilePath: localRawVideo,
        outputDirectory: hlsOutputDir,
        segmentDurationSeconds: 6,
      });

      // 3. Upload all generated HLS artifacts to S3
      await job.updateProgress(70);
      const targetPrefix = `hls/${productId}`;

      for (const relFile of transcodeResult.generatedFiles) {
        const localFilePath = join(hlsOutputDir, relFile);
        const s3Key = `${targetPrefix}/${relFile}`;
        const contentType = this.getContentTypeForFile(relFile);

        await this.s3Storage.uploadFileFromDisk(
          bucket,
          s3Key,
          localFilePath,
          contentType
        );
      }

      // 4. Update Product in Database
      await job.updateProgress(90);
      const masterPlaylistS3Key = `${targetPrefix}/master.m3u8`;

      product.updateDetails({
        contentS3Key: masterPlaylistS3Key,
        metadata: {
          ...product.metadata,
          durationSeconds: transcodeResult.durationSeconds,
          resolutions: transcodeResult.resolutions,
          hlsMasterKey: masterPlaylistS3Key,
          transcodeStatus: TranscodeStatus.COMPLETED,
          transcodedAt: new Date().toISOString(),
          sourceMasterKey: rawS3Key,
        },
      });
      await this.productRepository.update(product);

      await job.updateProgress(100);

      const segmentCount = transcodeResult.generatedFiles.filter((f) =>
        f.endsWith(".ts")
      ).length;

      this.logger.log(
        `Successfully transcoded product [${productId}] -> ${masterPlaylistS3Key} (${transcodeResult.resolutions.join(", ")}) [${segmentCount} segments]`
      );

      return {
        productId,
        masterPlaylistS3Key,
        durationSeconds: transcodeResult.durationSeconds,
        resolutions: transcodeResult.resolutions,
        segmentCount,
        totalSizeBytes: transcodeResult.totalSizeBytes,
      };
    } catch (error) {
      this.logger.error(
        `Video transcoding failed for product [${productId}]: ${(error as Error).message}`,
        (error as Error).stack
      );

      try {
        const currentProduct = await this.productRepository.findById(productId);
        if (currentProduct) {
          currentProduct.updateDetails({
            metadata: {
              ...currentProduct.metadata,
              transcodeStatus: TranscodeStatus.FAILED,
              transcodeError: (error as Error).message,
            },
          });
          await this.productRepository.update(currentProduct);
        }
      } catch (saveErr) {
        this.logger.error(
          `Failed to record transcode failure state on product [${productId}]: ${(saveErr as Error).message}`
        );
      }

      throw error;
    } finally {
      // Guaranteed scratch directory cleanup to prevent disk exhaustion
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to cleanup temp transcode directory '${tempDir}': ${(cleanupErr as Error).message}`
        );
      }
    }
  }

  private getContentTypeForFile(filename: string): string {
    if (filename.endsWith(".m3u8")) {
      return "application/vnd.apple.mpegurl";
    }
    if (filename.endsWith(".ts")) {
      return "video/MP2T";
    }
    return "application/octet-stream";
  }
}
