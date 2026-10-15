import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoursesRepository } from "./courses.repository";
import { CoursesService } from "./courses.service";
import { CoursesController, MyCoursesController } from "./courses.controller";
@Module({
  imports: [PrismaModule, UsersModule, AuditModule, AuthModule],
  controllers: [CoursesController, MyCoursesController],
  providers: [CoursesRepository, CoursesService],
})
export class CoursesModule {}
