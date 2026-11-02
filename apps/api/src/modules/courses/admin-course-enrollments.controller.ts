import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Header,
  HttpCode,
  PipeTransform,
} from "@nestjs/common";
import { z } from "zod";
import {
  JwtPayload,
  UserRole,
  adminCourseEnrollmentQuerySchema,
  adminUserCourseQuerySchema,
  adminCourseCandidateQuerySchema,
  adminEnrollmentAddSchema,
  adminEnrollmentActionSchema,
  adminCourseUserCreateSchema,
  AdminEnrollmentAddInput,
  AdminEnrollmentActionInput,
  AdminCourseUserCreateInput,
  AdminCourseEnrollmentQuery,
  AdminCourseCandidateQuery,
} from "@vetralink/shared-types";
import { CurrentUser, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { ValidationDomainException } from "../../common/exceptions/domain.exception";
import { AdminCourseEnrollmentsService } from "./admin-course-enrollments.service";
// Sensitive inputs must never include Zod's unknown-key text in public errors.
class EnrollmentInputPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodTypeAny) {}
  transform(value: unknown) {
    if (Buffer.byteLength(JSON.stringify(value ?? {})) > 8192)
      throw new ValidationDomainException("Invalid enrollment request.");
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new ValidationDomainException("Invalid enrollment request.");
    return result.data;
  }
}
@Controller("admin/courses")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCourseEnrollmentsController {
  constructor(private readonly service: AdminCourseEnrollmentsService) {}
  @Get(":id/enrollments") @Header("Cache-Control", "private, no-store") list(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new EnrollmentInputPipe(adminCourseEnrollmentQuerySchema))
    q: AdminCourseEnrollmentQuery,
  ) {
    return this.service.list(c, id, q);
  }
  @Get(":id/enrollment-candidates")
  @Header("Cache-Control", "private, no-store")
  candidates(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new EnrollmentInputPipe(adminCourseCandidateQuerySchema))
    q: AdminCourseCandidateQuery,
  ) {
    return this.service.candidates(c, id, q);
  }
  @Post(":id/enrollments/create-user")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  create(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new EnrollmentInputPipe(adminCourseUserCreateSchema))
    input: AdminCourseUserCreateInput,
  ) {
    return this.service.createUserAndEnroll(c, id, input);
  }
  @Post(":id/enrollments")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  add(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new EnrollmentInputPipe(adminEnrollmentAddSchema))
    input: AdminEnrollmentAddInput,
  ) {
    return this.service.add(c, id, input);
  }
  @Post(":id/enrollments/:userId/actions")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  act(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body(new EnrollmentInputPipe(adminEnrollmentActionSchema))
    input: AdminEnrollmentActionInput,
  ) {
    return this.service.act(c, id, userId, input);
  }
}
@Controller("admin/directory/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUserCoursesController {
  constructor(private readonly service: AdminCourseEnrollmentsService) {}
  @Get(":id/courses") @Header("Cache-Control", "private, no-store") courses(
    @CurrentUser() c: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query(new EnrollmentInputPipe(adminUserCourseQuerySchema))
    q: AdminCourseEnrollmentQuery,
  ) {
    return this.service.userCourses(c, id, q);
  }
}
