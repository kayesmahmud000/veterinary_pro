import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  JwtPayload,
  CourseQuery,
  courseQuerySchema,
  courseLibraryQuerySchema,
} from "@vetralink/shared-types";
import { Public, CurrentUser } from "../../common/decorators";
import { JwtAuthGuard } from "../../common/guards";
import { SchemaValidationPipe } from "../../common/pipes/schema-validation.pipe";
import { CoursesService } from "./courses.service";
@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get() @Public() @Header("Cache-Control", "no-store") list(
    @Query(new SchemaValidationPipe(courseQuerySchema)) q: CourseQuery,
  ) {
    return this.courses.list(q);
  }
  @Get("slug/:slug") @Public() @Header("Cache-Control", "no-store") detail(
    @Param(
      "slug",
      new SchemaValidationPipe(
        z
          .string()
          .min(3)
          .max(200)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ),
    )
    slug: string,
  ) {
    return this.courses.bySlug(slug);
  }
  @Get(":id/lessons/:lessonId/demo-playback")
  @Public()
  @Header("Cache-Control", "no-store")
  demo(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
  ) {
    return this.courses.demoPlayback(id, lessonId);
  }
}
@Controller("me/courses")
@UseGuards(JwtAuthGuard)
export class MyCoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get() @Header("Cache-Control", "private, no-store") list(
    @CurrentUser() u: JwtPayload,
    @Query(new SchemaValidationPipe(courseLibraryQuerySchema))
    q: Omit<CourseQuery, "search">,
  ) {
    return this.courses.myCourses(u, q);
  }
  @Get(":id") @Header("Cache-Control", "private, no-store") detail(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.courses.myDetail(u, id);
  }
  @Post(":id/enrollment")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  enroll(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaValidationPipe(z.object({}).strict()))
    _body: Record<string, never>,
  ) {
    return this.courses.enroll(u, id);
  }
  @Get(":id/lessons/:lessonId/playback")
  @Header("Cache-Control", "private, no-store")
  playback(
    @CurrentUser() u: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
  ) {
    return this.courses.lessonPlayback(u, id, lessonId);
  }
}
