import { Queue } from "bullmq";
import { VideoTranscodeJobData, VideoTranscodeResultDto } from "@vetralink/shared-types";
import { VideoTranscodeQueueService } from "./video-transcode-queue.service";

describe("VideoTranscodeQueueService", () => {
  let service: VideoTranscodeQueueService;
  let mockQueue: jest.Mocked<Partial<Queue<VideoTranscodeJobData, VideoTranscodeResultDto>>>;

  const mockJobData: VideoTranscodeJobData = {
    productId: "prod-1111",
    rawS3Key: "raw-videos/prod-1111/master.mp4",
    bucket: "test-media-bucket",
    requestedBy: "user-vet-1",
  };

  beforeEach(() => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    service = new VideoTranscodeQueueService(
      mockQueue as Queue<VideoTranscodeJobData, VideoTranscodeResultDto>
    );
  });

  describe("dispatchTranscodeJob", () => {
    it("should enqueue a transcode job with exponential retry backoff", async () => {
      const mockJob = { id: "job-12345" };
      (mockQueue.add as jest.Mock).mockResolvedValueOnce(mockJob);

      const result = await service.dispatchTranscodeJob(mockJobData);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "transcode",
        mockJobData,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 10000 },
        })
      );
      expect(result).toEqual({ jobId: "job-12345" });
    });
  });

  describe("getJobStatus", () => {
    it("should return null if job is not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValueOnce(null);

      const status = await service.getJobStatus("non-existent-id");

      expect(status).toBeNull();
    });

    it("should return job status, state and progress when job exists", async () => {
      const mockJob = {
        id: "job-123",
        getState: jest.fn().mockResolvedValue("active"),
        progress: 65,
        data: mockJobData,
        returnvalue: null,
        failedReason: null,
      };

      (mockQueue.getJob as jest.Mock).mockResolvedValueOnce(mockJob);

      const status = await service.getJobStatus("job-123");

      expect(status).toEqual({
        jobId: "job-123",
        state: "active",
        progress: 65,
        data: mockJobData,
        result: undefined,
        failedReason: undefined,
      });
    });
  });
});
