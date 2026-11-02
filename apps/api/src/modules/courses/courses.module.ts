import { AdminCourseEnrollmentsController, AdminUserCoursesController } from "./admin-course-enrollments.controller";
import { AdminCourseEnrollmentsService } from "./admin-course-enrollments.service";
import { AdminCourseEnrollmentsRepository } from "./admin-course-enrollments.repository";
import { CourseEnrollmentWriter } from "./course-enrollment-writer.service";
import { WorkflowRateLimitModule } from "../../common/security/workflow-rate-limiter";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoursesRepository } from "./courses.repository";
import { YouTubeDurationService } from "./youtube-duration.service";
import { CoursesService } from "./courses.service";
import { CoursesController, MyCoursesController } from "./courses.controller";
@Module({
  imports: [WorkflowRateLimitModule, PrismaModule, UsersModule, AuditModule, AuthModule],
  controllers: [AdminCourseEnrollmentsController, AdminUserCoursesController, CoursesController, MyCoursesController],
  providers: [AdminCourseEnrollmentsService, AdminCourseEnrollmentsRepository, CourseEnrollmentWriter, CoursesRepository, CoursesService, YouTubeDurationService],
})
export class CoursesModule {}
