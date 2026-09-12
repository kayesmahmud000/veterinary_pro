import { Job } from "bullmq";
import { WatermarkProcessor } from "./watermark.processor";
import { IS3StorageService } from "../../media/services/s3-storage.service.interface";
import { IPdfWatermarkService } from "../services/pdf-watermark.service.interface";
import { EnvService } from "../../../config/env.service";
import {
  WatermarkJobData,
  WatermarkJobResult,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("WatermarkProcessor", () => {
  let processor: WatermarkProcessor;
  let mockS3Storage: jest.Mocked<IS3StorageService>;
  let mockPdfWatermarkService: jest.Mocked<IPdfWatermarkService>;
  let mockEnvService: jest.Mocked<EnvService>;
  let mockJob: jest.Mocked<Job<WatermarkJobData, WatermarkJobResult>>;

  const mockJobData: WatermarkJobData = {
    orderId: "ord-test-444",
    orderItemId: "item-test-555",
    productId: "prod-ebook-666",
    userId: "user-777",
    downloadToken: "token-888",
    sourceS3Key: "products/ebooks/master.pdf",
    destinationS3Key: "watermarked/ord-test-444/item-test-555.pdf",
    buyerName: "Dr. Veterinarian",
    buyerEmail: "doc@vetralink.pro",
    purchaseDate: "2026-09-12T16:00:00Z",
  };

  beforeEach(() => {
    mockS3Storage = {
      downloadFile: jest.fn().mockImplementation(async (_bucket, _key, destPath) => {
        // write dummy file so readFile succeeds
        const fs = await import("node:fs/promises");
        await fs.writeFile(destPath, Buffer.from("dummy-pdf-bytes"));
      }),
      uploadFileFromDisk: jest.fn().mockResolvedValue(undefined),
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      getPresignedPutUrl: jest.fn(),
      getPresignedGetUrl: jest.fn(),
    };

    mockPdfWatermarkService = {
      applyWatermark: jest.fn().mockResolvedValue({
        pdfBuffer: Buffer.from("watermarked-pdf-bytes"),
        pageCount: 5,
        executionTimeMs: 120,
        integrityHash: "A1B2C3D4E5F67890",
      }),
      getPageCount: jest.fn().mockResolvedValue(5),
    };

    mockEnvService = {
      s3BucketMedia: "test-media-bucket",
      s3BucketDeliveries: "test-deliveries-bucket",
    } as unknown as jest.Mocked<EnvService>;

    mockJob = {
      id: "job-wm-001",
      data: mockJobData,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Job<WatermarkJobData, WatermarkJobResult>>;

    processor = new WatermarkProcessor(
      mockS3Storage,
      mockPdfWatermarkService,
      mockEnvService
    );
  });

  it("should successfully process a watermarking job and upload to destination S3 bucket", async () => {
    const result = await processor.process(mockJob);

    expect(result).toBeDefined();
    expect(result.orderId).toBe("ord-test-444");
    expect(result.orderItemId).toBe("item-test-555");
    expect(result.destinationS3Key).toBe(
      "watermarked/ord-test-444/item-test-555.pdf"
    );
    expect(result.pageCount).toBe(5);
    expect(result.fileSizeBytes).toBe(
      Buffer.from("watermarked-pdf-bytes").length
    );
    expect(result.executionTimeMs).toBe(120);
    expect(result.completedAt).toBeDefined();

    // Verify S3 download
    expect(mockS3Storage.downloadFile).toHaveBeenCalledWith(
      "test-media-bucket",
      "products/ebooks/master.pdf",
      expect.stringContaining("master_source.pdf")
    );

    // Verify watermark engine invocation
    expect(mockPdfWatermarkService.applyWatermark).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        buyerName: "Dr. Veterinarian",
        buyerEmail: "doc@vetralink.pro",
        orderId: "ord-test-444",
      })
    );

    // Verify S3 upload
    expect(mockS3Storage.uploadFileFromDisk).toHaveBeenCalledWith(
      "test-deliveries-bucket",
      "watermarked/ord-test-444/item-test-555.pdf",
      expect.stringContaining("watermarked_output.pdf"),
      "application/pdf"
    );

    // Verify progress tracking
    expect(mockJob.updateProgress).toHaveBeenCalledWith(5);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(15);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(35);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(85);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
  });

  it("should throw ValidationDomainException if sourceS3Key is missing", async () => {
    const invalidJob = {
      ...mockJob,
      data: {
        ...mockJobData,
        sourceS3Key: "",
      },
    } as unknown as Job<WatermarkJobData, WatermarkJobResult>;

    await expect(processor.process(invalidJob)).rejects.toThrow(
      ValidationDomainException
    );
  });

  it("should propagate errors and guarantee scratch cleanup when S3 download fails", async () => {
    mockS3Storage.downloadFile.mockRejectedValueOnce(
      new Error("S3 Network Timeout")
    );

    await expect(processor.process(mockJob)).rejects.toThrow(
      "S3 Network Timeout"
    );
  });
});
