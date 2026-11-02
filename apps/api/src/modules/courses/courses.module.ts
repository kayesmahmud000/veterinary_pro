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
  imports: [PrismaModule, UsersModule, AuditModule, AuthModule],
  controllers: [CoursesController, MyCoursesController],
  providers: [CoursesRepository, CoursesService, YouTubeDurationService],
})
export class CoursesModule {}
