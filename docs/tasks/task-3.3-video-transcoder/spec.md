# SPEC-303: BullMQ Video Processing Worker with FFmpeg Multi-Bitrate HLS Segmentation
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.3: BullMQ video processing worker: FFmpeg automated multi-bitrate HLS segmentation
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem Statement
In agricultural and rural veterinary communities, field farmers and livestock managers access video courses (e.g. surgical procedures, mastitis diagnostics, antibiotic stewardship) over volatile 3G/4G or satellite cellular connections. 

Currently, instructors upload raw master video assets (MP4, MOV, MKV) up to 10GB directly to S3 via Task 3.2's multipart pipeline. Serving these raw masters directly causes severe performance bottlenecks:
1. **Excessive Buffer & Latency**: A 2GB MP4 master requires continuous high throughput. Slow rural connections freeze repeatedly.
2. **No Adaptive Bitrate (ABR)**: Single-bitrate MP4 cannot dynamically downscale resolution or bitrate when farm connectivity degrades.
3. **High Bandwidth & Storage Egress Costs**: Direct MP4 delivery transfers uncompressed or inefficient video streams across CDNs.
4. **Piracy Exposure**: Raw MP4 files are easily scraped and ripped via browser network inspectors without encryption barriers.

### 1.2 Proposed Solution
Implement an asynchronous, scalable **BullMQ Video Processing Worker** utilizing **FFmpeg** to:
1. Receive transcode jobs upon video upload completion via Redis-backed queue.
2. Inspect and probe the master video (duration, resolution, audio tracks).
3. Compute an optimized Adaptive Bitrate (ABR) ladder (1080p, 720p, 480p, 360p) capped by the master source resolution (no upscaling).
4. Segment the video into HTTP Live Streaming (HLS) multi-variant playlists (`master.m3u8`, variant `stream.m3u8`, and 6-second `.ts` chunks).
5. Stream/upload the transcoded HLS directory structure to the S3 media bucket (`hls/<productId>/...`).
6. Update the product entity in PostgreSQL with the master HLS key, stream duration, available resolutions, and transcode status.
7. Clean up local scratch disk space reliably in `finally` blocks to guarantee zero storage leaks.

---

## 2. Current State vs. Proposed State

| Dimension | Current State (Task 3.2) | Proposed State (Task 3.3) |
| :--- | :--- | :--- |
| **Ingestion Output** | Master raw video resides in `s3://vetralink-media/raw-videos/...` | Raw master is automatically queued for multi-bitrate HLS segmentation |
| **Streaming Format** | Raw static video file (single bitrate, large file) | Multi-bitrate HLS (1080p, 720p, 480p, 360p) with master playlist |
| **Playback Adaptability** | Constant bitrate; buffering/stalling on slow mobile connections | Dynamic adaptive streaming switching seamlessly based on bandwidth |
| **Job Orchestration** | None (synchronous upload completion only) | BullMQ distributed queue on Redis with retry policies and progress tracking |
| **Database Tracking** | `contentS3Key` points to raw master file | `contentS3Key` updated to `hls/<productId>/master.m3u8`; metadata tracks status |
| **Resilience & Fault Tolerance** | N/A | BullMQ exponential backoff, job failure recording, and scratch disk cleanup |

---

## 3. Architectural & Design Trade-offs

| Decision Point | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Worker Topology** | External standalone microservice container | In-process NestJS BullMQ Module with isolated clean service architecture | Hosting the worker in `apps/api` under `modules/transcoder/` provides direct access to Prisma repositories, S3 storage adapter, and validated configuration while avoiding microservice IPC overhead. Its clean architecture allows seamless extraction into an independent container (`infrastructure/workers/`) when scale demands. |
| **Transcoding Engine** | Cloud SaaS (AWS Elemental MediaConvert) | Self-Hosted FFmpeg orchestrated via Node.js child process wrapper | Zero per-minute transcoding fees ($0.015–$0.030/min saved). Full local development parity using Docker/MinIO without AWS internet access. Portability across cloud, bare-metal, and on-premise AgTech deployments. |
| **Resolution Scaling Policy** | Always encode all 4 renditions (1080p, 720p, 480p, 360p) | Ceiling Ladder (Downscale Only): only generate renditions with height $\le$ source height | Upscaling a 720p or 480p source to 1080p wastes CPU, disk space, and bandwidth without improving visual quality. The ceiling ladder preserves quality while optimizing resource utilization. |
| **HLS Segment Duration** | 2-second segments | 6-second segments | 2-second segments create excessive HTTP requests and manifest parsing overhead on slow 3G cellular connections. 6-second segments provide optimal balance between playback start time and network request throughput. |
| **File I/O & Cleanup** | Process videos in RAM via streams | Local temp directory (`os.tmpdir()`) with UUID isolation and guaranteed cleanup | 10GB video masters exceed Node.js heap limits (`max-old-space-size`). Disk-based processing handles multi-gigabyte files effortlessly, with `try/finally` cleanup preventing storage leaks. |

---

## 4. Adaptive Bitrate (ABR) Ladder Specification

The video processing pipeline standardizes on H.264 (AVC) video codec and AAC audio codec for universal cross-platform playback across Next.js web players (video.js, hls.js) and Flutter mobile apps (BetterPlayer):

| Rendition | Resolution | Video Bitrate | Max Bitrate | Buffer Size | Audio Bitrate | Audio Sample Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1080p** (FHD) | 1920x1080 | 4,500 kbps | 4,800 kbps | 9,000 kbps | 128 kbps | 48 kHz |
| **720p** (HD) | 1280x720 | 2,500 kbps | 2,700 kbps | 5,000 kbps | 128 kbps | 48 kHz |
| **480p** (SD) | 854x480 | 1,200 kbps | 1,300 kbps | 2,400 kbps | 96 kbps | 44.1 kHz |
| **360p** (Low) | 640x360 | 800 kbps | 850 kbps | 1,600 kbps | 64 kbps | 44.1 kHz |

### Master Playlist Structure (`master.m3u8`)
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=4628000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1296000,RESOLUTION=854x480
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=864000,RESOLUTION=640x360
360p/index.m3u8
```

---

## 5. Data Models, Enums & Contracts

### 5.1 Enums & Shared Types (`@vetralink/shared-types`)
```typescript
export enum TranscodeStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface VideoTranscodeJobData {
  readonly productId: string;
  readonly rawS3Key: string;
  readonly bucket: string;
  readonly outputPrefix?: string;
  readonly requestedBy: string;
}

export interface VideoTranscodeResultDto {
  readonly productId: string;
  readonly masterPlaylistS3Key: string;
  readonly durationSeconds: number;
  readonly resolutions: string[];
  readonly segmentCount: number;
  readonly totalSizeBytes: number;
}

export interface TranscodeJobStatusResponseDto {
  readonly jobId: string;
  readonly state: "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";
  readonly progress: number; // 0 - 100
  readonly data: VideoTranscodeJobData;
  readonly result?: VideoTranscodeResultDto;
  readonly failedReason?: string;
}
```

### 5.2 Product Metadata Extension
```typescript
export interface ProductVideoMetadata {
  durationSeconds?: number;
  resolutions?: string[];
  hlsMasterKey?: string;
  transcodeStatus?: TranscodeStatus;
  transcodeError?: string;
  transcodedAt?: string;
  sourceMasterKey?: string;
}
```

---

## 6. API Endpoints

```http
POST /api/v1/media/transcode
Headers: Authorization: Bearer <AdminOrVetToken>
Body:
{
  "productId": "11111111-1111-1111-1111-111111111111",
  "rawS3Key": "raw-videos/11111111-1111-1111-1111-111111111111/master.mp4"
}
Response (202 Accepted):
{
  "success": true,
  "statusCode": 202,
  "message": "Video transcoding job queued successfully",
  "data": {
    "jobId": "video-transcode-prod-1111",
    "productId": "11111111-1111-1111-1111-111111111111",
    "status": "PENDING"
  }
}
```

```http
GET /api/v1/media/transcode/:jobId/status
Headers: Authorization: Bearer <AdminOrVetToken>
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Transcoding job status retrieved",
  "data": {
    "jobId": "video-transcode-prod-1111",
    "state": "active",
    "progress": 65,
    "data": {
      "productId": "11111111-1111-1111-1111-111111111111",
      "rawS3Key": "raw-videos/.../master.mp4"
    }
  }
}
```

---

## 7. Security, Invariants & Edge Cases

1. **Local Scratch File Isolation**:
   - Every transcode task generates a dedicated temporary directory under `os.tmpdir()/vetralink-transcode-<uuid>/`.
   - Guaranteed cleanup in a `finally` block using `fs.promises.rm(dir, { recursive: true, force: true })`.
2. **Corrupted or Malformed Video Detection**:
   - `ffprobe` probes input stream headers before transcoding starts.
   - If audio/video stream duration or codec is invalid, the job terminates immediately with `ValidationDomainException` without running costly FFmpeg processes.
3. **Ceiling Rule**:
   - If input resolution is $1280\times720$, 1080p is excluded from the ladder to prevent artificial pixel interpolation and wasted compute.
4. **BullMQ Worker Concurrency & Memory Limits**:
   - Worker concurrency defaults to 1 (or configurable via `TRANSCODE_CONCURRENCY`) to prevent CPU/memory starvation on multi-core servers running alongside NestJS.
   - BullMQ job configuration: 3 retry attempts with exponential backoff (delay: 10s).
5. **Role-Based Access Control**:
   - Triggering and polling transcode endpoints strictly guarded by `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.
