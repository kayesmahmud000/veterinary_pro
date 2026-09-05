import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "../auth";
import { ProductsModule } from "../products";
import { S3StorageService } from "./services/s3-storage.service";
import { S3_STORAGE_SERVICE } from "./services/s3-storage.service.interface";
import { MediaUploadService } from "./services/media-upload.service";
import { MEDIA_UPLOAD_SERVICE } from "./services/media-upload.service.interface";
import { FfmpegTranscoderService } from "./services/ffmpeg-transcoder.service";
import { VIDEO_TRANSCODER_SERVICE } from "./services/video-transcoder.service.interface";
import { VideoTranscodeQueueService } from "./services/video-transcode-queue.service";
import {
  VIDEO_TRANSCODE_QUEUE,
  VIDEO_TRANSCODE_QUEUE_SERVICE,
} from "./services/video-transcode-queue.service.interface";
import { VideoTranscodeProcessor } from "./processors/video-transcode.processor";
import { MediaUploadController } from "./media-upload.controller";

@Module({
  imports: [
    AuthModule,
    ProductsModule,
    BullModule.registerQueue({
      name: VIDEO_TRANSCODE_QUEUE,
    }),
  ],
  controllers: [MediaUploadController],
  providers: [
    S3StorageService,
    {
      provide: S3_STORAGE_SERVICE,
      useClass: S3StorageService,
    },
    MediaUploadService,
    {
      provide: MEDIA_UPLOAD_SERVICE,
      useClass: MediaUploadService,
    },
    FfmpegTranscoderService,
    {
      provide: VIDEO_TRANSCODER_SERVICE,
      useClass: FfmpegTranscoderService,
    },
    VideoTranscodeQueueService,
    {
      provide: VIDEO_TRANSCODE_QUEUE_SERVICE,
      useClass: VideoTranscodeQueueService,
    },
    VideoTranscodeProcessor,
  ],
  exports: [
    S3StorageService,
    S3_STORAGE_SERVICE,
    MediaUploadService,
    MEDIA_UPLOAD_SERVICE,
    FfmpegTranscoderService,
    VIDEO_TRANSCODER_SERVICE,
    VideoTranscodeQueueService,
    VIDEO_TRANSCODE_QUEUE_SERVICE,
  ],
})
export class MediaModule {}

