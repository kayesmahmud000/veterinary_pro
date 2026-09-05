import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { S3StorageService } from "./services/s3-storage.service";
import { S3_STORAGE_SERVICE } from "./services/s3-storage.service.interface";
import { MediaUploadService } from "./services/media-upload.service";
import { MEDIA_UPLOAD_SERVICE } from "./services/media-upload.service.interface";
import { MediaUploadController } from "./media-upload.controller";

@Module({
  imports: [AuthModule],
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
  ],
  exports: [
    S3StorageService,
    S3_STORAGE_SERVICE,
    MediaUploadService,
    MEDIA_UPLOAD_SERVICE,
  ],
})
export class MediaModule {}
