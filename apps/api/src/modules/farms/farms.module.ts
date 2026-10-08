import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { PrismaModule } from "../prisma";
import { SubscriptionsModule } from "../subscriptions";
import { FarmMemberRepository } from "./repositories/farm-member.repository";
import { FARM_MEMBER_REPOSITORY } from "./repositories/farm-member.repository.interface";
import { FarmMembersService } from "./services/farm-members.service";
import { FARM_MEMBERS_SERVICE } from "./services/farm-members.service.interface";
import { FarmMembersController } from "./farm-members.controller";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { FarmOnboardingController } from "./farm-onboarding.controller";
import { FarmOnboardingService } from "./services/farm-onboarding.service";
import { FarmOnboardingRepository } from "./repositories/farm-onboarding.repository";

@Module({
  imports: [
    PrismaModule,
    SubscriptionsModule,
    AuthModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [FarmMembersController, FarmOnboardingController],
  providers: [
    FarmOnboardingRepository,
    FarmOnboardingService,
    FarmMemberRepository,
    {
      provide: FARM_MEMBER_REPOSITORY,
      useClass: FarmMemberRepository,
    },
    FarmMembersService,
    {
      provide: FARM_MEMBERS_SERVICE,
      useClass: FarmMembersService,
    },
  ],
  exports: [
    FarmMemberRepository,
    FARM_MEMBER_REPOSITORY,
    FarmMembersService,
    FARM_MEMBERS_SERVICE,
  ],
})
export class FarmsModule {}
