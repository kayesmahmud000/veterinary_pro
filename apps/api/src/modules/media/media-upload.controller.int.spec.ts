import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import {
  MediaCategory,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { MediaUploadController } from "./media-upload.controller";
import {
  IMediaUploadService,
  MEDIA_UPLOAD_SERVICE,
} from "./services/media-upload.service.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import {
  IVideoTranscodeQueueService,
  VIDEO_TRANSCODE_QUEUE_SERVICE,
} from "./services/video-transcode-queue.service.interface";
import { EnvService } from "../../config/env.service";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";

describe("MediaUploadController (Integration via Supertest)", () => {
  let app: INestApplication;
  let mediaUploadService: jest.Mocked<IMediaUploadService>;
  let transcodeQueueService: jest.Mocked<IVideoTranscodeQueueService>;
  let tokenService: jest.Mocked<ITokenService>;

  const vetPayload = {
    sub: "vet-1111-1111-1111-111111111111",
    email: "vet@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const farmerPayload = {
    sub: "farmer-1111-1111-1111-111111111111",
    email: "farmer@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const vetToken = "valid-vet-token";
  const farmerToken = "valid-farmer-token";

  beforeAll(async () => {
    mediaUploadService = {
      initiateMultipartUpload: jest.fn(),
      getPresignedPartUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      generateDirectUploadUrl: jest.fn(),
    };

    transcodeQueueService = {
      dispatchTranscodeJob: jest.fn(),
      getJobStatus: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === vetToken) return vetPayload;
        if (token === farmerToken) return farmerPayload;
        throw new Error("Invalid token");
      }),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MediaUploadController],
      providers: [
        {
          provide: MEDIA_UPLOAD_SERVICE,
          useValue: mediaUploadService,
        },
        {
          provide: VIDEO_TRANSCODE_QUEUE_SERVICE,
          useValue: transcodeQueueService,
        },
        {
          provide: EnvService,
          useValue: { s3BucketMedia: "vetralink-media" },
        },
        {
          provide: TOKEN_SERVICE,
          useValue: tokenService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /media/uploads/multipart/initiate", () => {
    const validBody = {
      filename: "surgery-master.mp4",
      contentType: "video/mp4",
      fileSizeBytes: 52428800,
      category: MediaCategory.VIDEO_COURSE,
      entityId: "prod-1111",
    };

    it("should return 401 when no token is provided", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/multipart/initiate")
        .send(validBody)
        .expect(401);
    });

    it("should return 403 when a FARMER attempts to initiate upload", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/multipart/initiate")
        .set("Authorization", `Bearer ${farmerToken}`)
        .send(validBody)
        .expect(403);
    });

    it("should return 201 with multipart initialization metadata for VET", async () => {
      const responsePayload = {
        uploadId: "s3-upload-123",
        key: "raw-videos/prod-1111/1725540000-uuid.mp4",
        bucket: "vetralink-media",
        partSizeBytes: 10485760,
        totalParts: 5,
      };

      mediaUploadService.initiateMultipartUpload.mockResolvedValue(responsePayload);

      const res = await request(app.getHttpServer())
        .post("/media/uploads/multipart/initiate")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.message).toBe("Multipart upload initiated successfully");
      expect(res.body.data).toEqual(responsePayload);
      expect(mediaUploadService.initiateMultipartUpload).toHaveBeenCalledWith(
        validBody,
        vetPayload.sub
      );
    });

    it("should return 400 when invalid body is sent (missing required fields)", async () => {
      const res = await request(app.getHttpServer())
        .post("/media/uploads/multipart/initiate")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({ filename: "no-category.mp4" })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /media/uploads/multipart/part-url", () => {
    const validBody = {
      uploadId: "s3-upload-123",
      key: "raw-videos/test.mp4",
      partNumber: 1,
    };

    it("should return 200 with presigned part URL for VET", async () => {
      const partPayload = {
        url: "https://s3.amazonaws.com/part-1-presigned",
        partNumber: 1,
        expiresInSeconds: 3600,
      };

      mediaUploadService.getPresignedPartUrl.mockResolvedValue(partPayload);

      const res = await request(app.getHttpServer())
        .post("/media/uploads/multipart/part-url")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(partPayload);
      expect(mediaUploadService.getPresignedPartUrl).toHaveBeenCalledWith(
        validBody
      );
    });

    it("should return 400 when partNumber is out of range (< 1)", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/multipart/part-url")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({ ...validBody, partNumber: 0 })
        .expect(400);
    });
  });

  describe("POST /media/uploads/multipart/complete", () => {
    const validBody = {
      uploadId: "s3-upload-123",
      key: "raw-videos/test.mp4",
      parts: [
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 2, etag: '"etag-2"' },
      ],
    };

    it("should return 200 with completed S3 metadata", async () => {
      const completePayload = {
        location: "https://bucket.s3.amazonaws.com/raw-videos/test.mp4",
        bucket: "vetralink-media",
        key: "raw-videos/test.mp4",
        etag: '"combined-etag"',
      };

      mediaUploadService.completeMultipartUpload.mockResolvedValue(completePayload);

      const res = await request(app.getHttpServer())
        .post("/media/uploads/multipart/complete")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(completePayload);
      expect(mediaUploadService.completeMultipartUpload).toHaveBeenCalledWith(
        validBody,
        vetPayload.sub
      );
    });

    it("should return 400 when parts array is empty", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/multipart/complete")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({ uploadId: "u-1", key: "k-1", parts: [] })
        .expect(400);
    });
  });

  describe("POST /media/uploads/multipart/abort", () => {
    const validBody = {
      uploadId: "s3-upload-123",
      key: "raw-videos/test.mp4",
    };

    it("should return 200 and abort upload", async () => {
      mediaUploadService.abortMultipartUpload.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post("/media/uploads/multipart/abort")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ aborted: true });
      expect(mediaUploadService.abortMultipartUpload).toHaveBeenCalledWith(
        validBody,
        vetPayload.sub
      );
    });
  });

  describe("POST /media/uploads/presigned-url", () => {
    const validBody = {
      filename: "dairy-guide.pdf",
      contentType: "application/pdf",
      fileSizeBytes: 10485760,
      category: MediaCategory.EBOOK,
    };

    it("should return 200 with direct presigned PUT URL", async () => {
      const presignedPayload = {
        uploadUrl: "https://s3.amazonaws.com/put-presigned",
        key: "ebooks/1725540000-uuid.pdf",
        bucket: "vetralink-media",
        expiresInSeconds: 900,
      };

      mediaUploadService.generateDirectUploadUrl.mockResolvedValue(
        presignedPayload
      );

      const res = await request(app.getHttpServer())
        .post("/media/uploads/presigned-url")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(presignedPayload);
      expect(mediaUploadService.generateDirectUploadUrl).toHaveBeenCalledWith(
        validBody,
        vetPayload.sub
      );
    });
  });

  describe("POST /media/uploads/transcode", () => {
    const validBody = {
      productId: "11111111-1111-4111-8111-111111111111",
      rawS3Key: "raw-videos/11111111-1111-4111-8111-111111111111/master.mp4",
    };

    it("should return 401 when no token is provided", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/transcode")
        .send(validBody)
        .expect(401);
    });

    it("should return 403 when FARMER requests transcoding", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/transcode")
        .set("Authorization", `Bearer ${farmerToken}`)
        .send(validBody)
        .expect(403);
    });

    it("should return 202 and queue transcode job for VET", async () => {
      transcodeQueueService.dispatchTranscodeJob.mockResolvedValueOnce({
        jobId: "transcode-prod-1111-12345",
      });

      const res = await request(app.getHttpServer())
        .post("/media/uploads/transcode")
        .set("Authorization", `Bearer ${vetToken}`)
        .send(validBody)
        .expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(202);
      expect(res.body.message).toBe("Video transcoding job queued successfully");
      expect(res.body.data).toEqual({
        jobId: "transcode-prod-1111-12345",
        productId: validBody.productId,
        status: "PENDING",
      });
      expect(transcodeQueueService.dispatchTranscodeJob).toHaveBeenCalledWith({
        productId: validBody.productId,
        rawS3Key: validBody.rawS3Key,
        bucket: "vetralink-media",
        requestedBy: vetPayload.sub,
      });
    });

    it("should return 400 when productId is not a valid UUID", async () => {
      await request(app.getHttpServer())
        .post("/media/uploads/transcode")
        .set("Authorization", `Bearer ${vetToken}`)
        .send({ productId: "invalid-uuid", rawS3Key: "raw-videos/video.mp4" })
        .expect(400);
    });
  });

  describe("GET /media/uploads/transcode/:jobId/status", () => {
    it("should return 401 when unauthenticated", async () => {
      await request(app.getHttpServer())
        .get("/media/uploads/transcode/job-123/status")
        .expect(401);
    });

    it("should return 200 with job status when job exists", async () => {
      const mockStatus = {
        jobId: "job-123",
        state: "active" as const,
        progress: 60,
        data: {
          productId: "prod-1",
          rawS3Key: "raw-videos/master.mp4",
          bucket: "vetralink-media",
          requestedBy: vetPayload.sub,
        },
      };

      transcodeQueueService.getJobStatus.mockResolvedValueOnce(mockStatus);

      const res = await request(app.getHttpServer())
        .get("/media/uploads/transcode/job-123/status")
        .set("Authorization", `Bearer ${vetToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockStatus);
    });

    it("should return 404 when job does not exist", async () => {
      transcodeQueueService.getJobStatus.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get("/media/uploads/transcode/non-existent-job/status")
        .set("Authorization", `Bearer ${vetToken}`)
        .expect(404);
    });
  });
});

