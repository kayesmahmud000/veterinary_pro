import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WatermarkJobData,
  WatermarkJobResult,
} from "@vetralink/shared-types";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../../media/services/s3-storage.service.interface";
import {
  IPdfWatermarkService,
  PDF_WATERMARK_SERVICE,
} from "../services/pdf-watermark.service.interface";
import { WATERMARK_QUEUE } from "../services/watermark-queue.service.interface";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
@Processor(WATERMARK_QUEUE)
export class WatermarkProcessor extends WorkerHost {
  private readonly logger = new Logger(WatermarkProcessor.name);

  constructor(
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3Storage: IS3StorageService,
    @Inject(PDF_WATERMARK_SERVICE)
    private readonly pdfWatermarkService: IPdfWatermarkService,
    private readonly envService: EnvService
  ) {
    super();
  }

  public async process(
    job: Job<WatermarkJobData, WatermarkJobResult>
  ): Promise<WatermarkJobResult> {
    const {
      orderId,
      orderItemId,
      productId,
      userId,
      downloadToken,
      sourceS3Key,
      destinationS3Key,
      buyerName,
      buyerEmail,
      purchaseDate,
    } = job.data;

    const sourceBucket = job.data.sourceBucket || this.envService.s3BucketMedia;
    const destinationBucket =
      job.data.destinationBucket || this.envService.s3BucketDeliveries;
    const targetDestKey =
      destinationS3Key || `watermarked/${orderId}/${orderItemId}.pdf`;

    this.logger.log(
      `Starting watermarking job [${job.id}] for order [${orderId}], item [${orderItemId}], product [${productId}] -> S3: ${destinationBucket}/${targetDestKey}`
    );

    if (!sourceS3Key) {
      throw new ValidationDomainException(
        `Cannot watermark PDF: sourceS3Key is missing for job [${job.id}].`
      );
    }

    await job.updateProgress(5);

    const tempDir = join(
      tmpdir(),
      `vetralink-watermark-${job.id || "job"}-${randomUUID()}`
    );
    await mkdir(tempDir, { recursive: true });

    try {
      // 1. Download authoritative master PDF from S3 source bucket
      await job.updateProgress(15);
      const localMasterPdf = join(tempDir, "master_source.pdf");
      await this.s3Storage.downloadFile(
        sourceBucket,
        sourceS3Key,
        localMasterPdf
      );

      // 2. Read file to buffer
      await job.updateProgress(35);
      const rawPdfBuffer = await readFile(localMasterPdf);

      // 3. Execute dynamic anti-piracy watermarking via pdf-lib
      await job.updateProgress(50);
      const watermarkResult = await this.pdfWatermarkService.applyWatermark(
        rawPdfBuffer,
        {
          buyerName: buyerName || "Licensed Customer",
          buyerEmail: buyerEmail || "customer@vetralink.pro",
          orderId,
          purchaseDate: purchaseDate || new Date().toISOString(),
          downloadToken,
        }
      );

      // 4. Save secured PDF to scratch path
      await job.updateProgress(75);
      const localWatermarkedPdf = join(tempDir, "watermarked_output.pdf");
      await writeFile(localWatermarkedPdf, watermarkResult.pdfBuffer);

      // 5. Upload secured PDF to S3 deliveries bucket
      await job.updateProgress(85);
      await this.s3Storage.uploadFileFromDisk(
        destinationBucket,
        targetDestKey,
        localWatermarkedPdf,
        "application/pdf"
      );

      await job.updateProgress(100);

      this.logger.log(
        `Successfully watermarked [${watermarkResult.pageCount} pages] for order [${orderId}], item [${orderItemId}] -> ${destinationBucket}/${targetDestKey} (${watermarkResult.executionTimeMs}ms, hash: ${watermarkResult.integrityHash ?? "none"})`
      );

      return {
        orderId,
        orderItemId,
        destinationS3Key: targetDestKey,
        pageCount: watermarkResult.pageCount,
        fileSizeBytes: watermarkResult.pdfBuffer.length,
        executionTimeMs: watermarkResult.executionTimeMs,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Watermarking failed for order [${orderId}], item [${orderItemId}]: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw error;
    } finally {
      // Guaranteed scratch directory cleanup to prevent disk exhaustion
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to cleanup temp watermark directory '${tempDir}': ${(cleanupErr as Error).message}`
        );
      }
    }
  }
}
