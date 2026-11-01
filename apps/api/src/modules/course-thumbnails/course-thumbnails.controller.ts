import {
  CallHandler,
  CanActivate,
  Controller,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { Request } from "express";
import {
  JwtPayload,
  UserRole,
  COURSE_THUMBNAIL_MAX_BYTES,
  COURSE_THUMBNAIL_MAX_REQUEST_BYTES,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { WorkflowException } from "../../common/exceptions/domain.exception";
import { EnvService } from "../../config";
import { CourseThumbnailsService } from "./course-thumbnails.service";
@Injectable()
export class ThumbnailUploadGuard implements CanActivate {
  constructor(
    private readonly env: EnvService,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    if (!this.env.cloudinaryThumbnailsEnabled)
      throw new WorkflowException(
        "THUMBNAIL_UNAVAILABLE",
        "Thumbnail uploads are unavailable.",
        503,
      );
    if (
      !req.headers["content-type"]
        ?.toLowerCase()
        .startsWith("multipart/form-data;")
    )
      throw new WorkflowException(
        "THUMBNAIL_UNSUPPORTED",
        "Use a multipart image upload.",
        415,
      );
    if (
      Number(req.headers["content-length"]) > COURSE_THUMBNAIL_MAX_REQUEST_BYTES
    )
      throw new WorkflowException(
        "THUMBNAIL_TOO_LARGE",
        "Image exceeds the upload limit.",
        413,
      );
    await this.limiter.hit("course-thumbnail-upload", req.user.sub, 10, 60);
    return true;
  }
}
@Injectable()
export class ThumbnailRequestLimit implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return new Observable((subscriber) => {
      let size = 0;
      const reject = (code: string, status: number) => {
        req.unpipe();
        req.resume();
        subscriber.error(
          new WorkflowException(code, "Upload could not be completed.", status),
        );
      };
      const count = (chunk: Buffer) => {
        size += chunk.length;
        if (size > COURSE_THUMBNAIL_MAX_REQUEST_BYTES)
          reject("THUMBNAIL_TOO_LARGE", 413);
      };
      req.on("data", count);
      const timer = setTimeout(() => reject("THUMBNAIL_TIMEOUT", 408), 30_000);
      const subscription = next.handle().subscribe(subscriber);
      return () => {
        clearTimeout(timer);
        req.off("data", count);
        subscription.unsubscribe();
      };
    });
  }
}
@ApiTags("Course thumbnails")
@ApiBearerAuth()
@Controller("admin/courses/thumbnails")
@UseGuards(JwtAuthGuard, RolesGuard, ThumbnailUploadGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CourseThumbnailsController {
  constructor(private readonly thumbnails: CourseThumbnailsService) {}
  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    ThumbnailRequestLimit,
    FileInterceptor("file", {
      limits: {
        fileSize: COURSE_THUMBNAIL_MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 2,
        fieldNameSize: 100,
        headerPairs: 20,
      },
    }),
  )
  upload(
    @CurrentUser() actor: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.thumbnails.upload(actor, file);
  }
}
