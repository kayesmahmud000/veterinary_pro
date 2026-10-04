# PLAN-303: BullMQ Video Processing Worker with FFmpeg Multi-Bitrate HLS Segmentation
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.3: BullMQ video processing worker: FFmpeg automated multi-bitrate HLS segmentation
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational.
- [x] Task 3.2: Presigned S3 direct multipart upload operational.
- [x] Redis connection configured via `REDIS_URL` in `env.schema.ts`.
- [x] Dependencies: Add `@nestjs/bullmq` and `bullmq` to `apps/api`.

---

## 2. Granular Implementation Steps

### Step 1: BullMQ Dependency Installation & Bull Module Configuration
- [x] Install BullMQ in `@vetralink/api`: `pnpm --filter @vetralink/api add @nestjs/bullmq bullmq`.
- [x] Configure `BullModule.forRootAsync` in `AppModule` (or `MediaModule`) using `EnvService.redisUrl` (parsing Redis host, port, password).

### Step 2: Transcode Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/media/video-transcode.dto.ts`:
  - `TranscodeStatus` enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
  - `VideoTranscodeJobData` interface.
  - `VideoTranscodeResultDto` interface.
  - `TranscodeJobStatusResponseDto` interface.
  - `QueueTranscodeRequestDto` interface.
  - `QueueTranscodeResponseDto` interface.
  - `ProductVideoMetadata` interface.
- [x] Export from `packages/shared-types/src/dto/media/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: S3 Storage Service File Streaming Extensions & Unit Tests
- [x] Update `IS3StorageService` and `S3StorageService`:
  - Implement `downloadFile(bucket: string, key: string, localDestinationPath: string): Promise<void>`.
  - Implement `uploadFileFromDisk(bucket: string, key: string, localFilePath: string, contentType: string): Promise<void>`.
- [x] Update `s3-storage.service.spec.ts` to verify download and upload from disk.

### Step 4: Video Transcoder Engine (`FfmpegTranscoderService`) & Unit Tests
- [x] Create `apps/api/src/modules/media/services/video-transcoder.service.interface.ts`:
  - `IVideoTranscoderService` interface.
  - Injection token `VIDEO_TRANSCODER_SERVICE = "VIDEO_TRANSCODER_SERVICE"`.
  - `VideoProbeResult`, `HlsTranscodeParams`, `HlsTranscodeResult` contracts.
- [x] Create `apps/api/src/modules/media/services/ffmpeg-transcoder.service.ts`:
  - `probeVideo(inputPath: string): Promise<VideoProbeResult>` (inspects duration, width, height).
  - `transcodeToHls(params: HlsTranscodeParams): Promise<HlsTranscodeResult>` (computes ceiling ladder, spawns FFmpeg multi-variant HLS segmentation, generates `master.m3u8` and variant streams).
- [x] Create `apps/api/src/modules/media/services/ffmpeg-transcoder.service.spec.ts`:
  - Unit tests verifying ladder determination, probe validation, and command generation.

### Step 5: BullMQ Queue Service & Transcode Processor
- [x] Create `apps/api/src/modules/media/services/video-transcode-queue.service.interface.ts` and implementation:
  - `IVideoTranscodeQueueService`: `dispatchTranscodeJob(...)`, `getJobStatus(...)`.
- [x] Create `apps/api/src/modules/media/processors/video-transcode.processor.ts`:
  - `@Processor('video-transcode')` with `@Process('transcode')`.
  - Downloads raw video to `os.tmpdir()/vetralink-transcode-<uuid>/`.
  - Updates product metadata `transcodeStatus: "PROCESSING"`.
  - Executes multi-bitrate HLS segmentation.
  - Uploads generated playlists and `.ts` segments to S3 under `hls/<productId>/`.
  - Updates product `contentS3Key` and `metadata` (`transcodeStatus: "COMPLETED"`, `hlsMasterKey`, duration, resolutions).
  - Scratch cleanup in `finally` block.
  - Failure handling with error logging and product metadata update (`transcodeStatus: "FAILED"`).
- [x] Create `video-transcode.processor.spec.ts` unit tests.

### Step 6: Controller Endpoints, Auto-Trigger & Supertest Integration Tests
- [x] Add transcode DTOs in `apps/api/src/modules/media/dto/`:
  - `queue-transcode.dto.ts`.
- [x] Add endpoints to `MediaUploadController`:
  - `POST /api/v1/media/uploads/transcode` (manual dispatch).
  - `GET /api/v1/media/uploads/transcode/:jobId/status` (polling).
- [x] Enhance `MediaUploadService.completeMultipartUpload`:
  - Automatically queue transcode job when `category === MediaCategory.VIDEO_COURSE` and `entityId` is present.
- [x] Author unit and integration tests:
  - Update `media-upload.controller.spec.ts` and `media-upload.controller.int.spec.ts`.

### Step 7: Module Wiring & Verification
- [x] Register `BullModule` in `apps/api/src/app.module.ts` and `MediaModule`.
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.3.

---

## 3. Acceptance Criteria
1. **Adaptive Bitrate Ladder Generation**: FFmpeg pipeline produces valid `master.m3u8`, variant playlists (1080p, 720p, 480p, 360p), and 6-second `.ts` segments without quality loss.
2. **Ceiling Rule Adherence**: Renditions strictly capped at master source resolution (no upscaling).
3. **Queue Ingestion & Status Tracking**: Transcode jobs can be dispatched, monitored with progress percentage, and polled via REST endpoint.
4. **S3 Artifact Distribution**: Transcoded HLS tree uploaded to S3 under `hls/<productId>/` with proper MIME types (`application/vnd.apple.mpegurl`, `video/MP2T`).
5. **Product Entity Synchronization**: Product's `contentS3Key` updated to HLS master playlist and metadata updated with duration, resolutions, and `COMPLETED` status.
6. **Zero Disk Leaks**: Temp scratch files unconditionally deleted on both success and failure in `finally` blocks.
7. **100% Test Pass Rate**: Full unit and integration tests passing with zero regressions.
