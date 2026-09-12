import { Queue } from "bullmq";
import { WatermarkQueueService } from "./watermark-queue.service";
import {
  WatermarkJobData,
  WatermarkJobResult,
  WatermarkJobStatus,
} from "@vetralink/shared-types";

describe("WatermarkQueueService", () => {
  let service: WatermarkQueueService;
  let mockQueue: jest.Mocked<
    Partial<Queue<WatermarkJobData, WatermarkJobResult>>
  >;

  const mockJobData: WatermarkJobData = {
    orderId: "ord-test-uuid",
    orderItemId: "item-test-uuid",
    productId: "prod-ebook-uuid",
    userId: "user-buyer-uuid",
    downloadToken: "token-download-uuid",
    sourceS3Key: "products/ebook-source.pdf",
    destinationS3Key: "watermarked/ord-test-uuid/item-test-uuid.pdf",
    buyerName: "Farmer Bob",
    buyerEmail: "bob@farms.com",
    purchaseDate: "2026-09-12T14:00:00Z",
  };

  beforeEach(() => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    service = new WatermarkQueueService(
      mockQueue as Queue<WatermarkJobData, WatermarkJobResult>
    );
  });

  describe("dispatchWatermarkJob", () => {
    it("should enqueue a watermark job with retries and backoff options", async () => {
      (mockQueue.add as jest.Mock).mockResolvedValueOnce({
        id: "job-12345",
      });

      const result = await service.dispatchWatermarkJob(mockJobData);

      expect(result).toEqual({ jobId: "job-12345" });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "watermark",
        mockJobData,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        })
      );
    });
  });

  describe("getJobStatus", () => {
    it("should return null if job is not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValueOnce(undefined);

      const status = await service.getJobStatus("non-existent-id");
      expect(status).toBeNull();
    });

    it("should return mapped status for completed job", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValueOnce({
        id: "job-comp",
        getState: jest.fn().mockResolvedValue("completed"),
        progress: 100,
        data: mockJobData,
        returnvalue: {
          orderId: mockJobData.orderId,
          orderItemId: mockJobData.orderItemId,
          destinationS3Key: mockJobData.destinationS3Key,
          pageCount: 15,
          fileSizeBytes: 204800,
          executionTimeMs: 450,
          completedAt: "2026-09-12T14:01:00Z",
        },
      } as any);

      const status = await service.getJobStatus("job-comp");

      expect(status).toBeDefined();
      expect(status?.jobId).toBe("job-comp");
      expect(status?.state).toBe(WatermarkJobStatus.COMPLETED);
      expect(status?.progress).toBe(100);
      expect(status?.result?.pageCount).toBe(15);
    });

    it("should return mapped status for failed job with reason", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValueOnce({
        id: "job-fail",
        getState: jest.fn().mockResolvedValue("failed"),
        progress: 35,
        data: mockJobData,
        failedReason: "S3 NoSuchKey error",
      } as any);

      const status = await service.getJobStatus("job-fail");

      expect(status).toBeDefined();
      expect(status?.jobId).toBe("job-fail");
      expect(status?.state).toBe(WatermarkJobStatus.FAILED);
      expect(status?.failedReason).toBe("S3 NoSuchKey error");
    });
  });
});
