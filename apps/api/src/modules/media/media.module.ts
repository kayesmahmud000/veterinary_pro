import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma";
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
import { DrmKeyService } from "./services/drm-key.service";
import { DRM_KEY_SERVICE } from "./services/drm-key.service.interface";
import { DrmTokenService } from "./services/drm-token.service";
import { DRM_TOKEN_SERVICE } from "./services/drm-token.service.interface";
import { EntitlementService } from "./services/entitlement.service";
import { ENTITLEMENT_SERVICE } from "./services/entitlement.service.interface";
import { CloudFrontSignerService } from "./services/cloudfront-signer.service";
import { CLOUDFRONT_SIGNER_SERVICE } from "./services/cloudfront-signer.service.interface";
import { StreamDeliveryService } from "./services/stream-delivery.service";
import { STREAM_DELIVERY_SERVICE } from "./services/stream-delivery.service.interface";
import { MediaUploadController } from "./media-upload.controller";
import { DrmKeyController } from "./drm-key.controller";
import { StreamDeliveryController } from "./stream-delivery.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    BullModule.registerQueue({
      name: VIDEO_TRANSCODE_QUEUE,
    }),
  ],
  controllers: [
    MediaUploadController,
    DrmKeyController,
    StreamDeliveryController,
  ],
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
    DrmKeyService,
    {
      provide: DRM_KEY_SERVICE,
      useClass: DrmKeyService,
    },
    DrmTokenService,
    {
      provide: DRM_TOKEN_SERVICE,
      useClass: DrmTokenService,
    },
    EntitlementService,
    {
      provide: ENTITLEMENT_SERVICE,
      useClass: EntitlementService,
    },
    CloudFrontSignerService,
    {
      provide: CLOUDFRONT_SIGNER_SERVICE,
      useClass: CloudFrontSignerService,
    },
    StreamDeliveryService,
    {
      provide: STREAM_DELIVERY_SERVICE,
      useClass: StreamDeliveryService,
    },
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
    DrmKeyService,
    DRM_KEY_SERVICE,
    DrmTokenService,
    DRM_TOKEN_SERVICE,
    EntitlementService,
    ENTITLEMENT_SERVICE,
    CloudFrontSignerService,
    CLOUDFRONT_SIGNER_SERVICE,
    StreamDeliveryService,
    STREAM_DELIVERY_SERVICE,
  ],
})
export class MediaModule {}


