import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../config";
import { WorkflowRateLimitModule } from "../../common/security/workflow-rate-limiter";
import { AuthModule } from "../auth/auth.module";
import {
  CourseThumbnailsController,
  ThumbnailRequestLimit,
  ThumbnailUploadGuard,
} from "./course-thumbnails.controller";
import { CourseThumbnailsService } from "./course-thumbnails.service";
import { CloudinaryThumbnailStorage } from "./cloudinary-thumbnail-storage.service";
import { THUMBNAIL_STORAGE } from "./thumbnail-storage.interface";
@Module({
  imports: [AppConfigModule, AuthModule, WorkflowRateLimitModule],
  controllers: [CourseThumbnailsController],
  providers: [
    CourseThumbnailsService,
    ThumbnailRequestLimit,
    ThumbnailUploadGuard,
    { provide: THUMBNAIL_STORAGE, useClass: CloudinaryThumbnailStorage },
  ],
})
export class CourseThumbnailsModule {}
