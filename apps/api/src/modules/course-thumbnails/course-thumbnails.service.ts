import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  courseThumbnailFileError,
  CourseThumbnailUploadResult,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { EnvService } from "../../config";
import {
  WorkflowException,
  ForbiddenOperationException,
} from "../../common/exceptions/domain.exception";
import { CurrentIdentityService } from "../auth/services/current-identity.service";
import { normalizeCourseThumbnail } from "./image-validator";
import {
  THUMBNAIL_STORAGE,
  ThumbnailStorage,
} from "./thumbnail-storage.interface";
@Injectable()
export class CourseThumbnailsService {
  constructor(
    private readonly env: EnvService,
    private readonly identities: CurrentIdentityService,
    @Inject(THUMBNAIL_STORAGE) private readonly storage: ThumbnailStorage,
  ) {}
  async upload(
    actor: JwtPayload,
    file?: Express.Multer.File,
  ): Promise<CourseThumbnailUploadResult> {
    if (!this.env.cloudinaryThumbnailsEnabled)
      throw new WorkflowException(
        "THUMBNAIL_UNAVAILABLE",
        "Thumbnail uploads are unavailable.",
        503,
      );
    if (!file)
      throw new WorkflowException("THUMBNAIL_EMPTY", "Choose an image.", 422);
    const error = courseThumbnailFileError({
      name: file.originalname,
      type: file.mimetype,
      size: file.buffer.length,
    });
    if (error)
      throw new WorkflowException(
        error,
        "Choose a JPEG, PNG or WebP image up to 3 MiB.",
        error === "THUMBNAIL_TOO_LARGE"
          ? 413
          : error === "THUMBNAIL_UNSUPPORTED"
            ? 415
            : 422,
      );
    const bytes = await normalizeCourseThumbnail(file.buffer, file.mimetype);
    const current = await this.identities.resolve(actor);
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(current.role))
      throw new ForbiddenOperationException();
    return this.storage.put(
      `${this.env.cloudinaryThumbnailsFolder}/${randomUUID()}`,
      bytes,
      "image/webp",
    );
  }
}
