import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { PrismaModule } from "../prisma";
import { SubscriptionsModule } from "../subscriptions";
import { FarmMemberRepository } from "./repositories/farm-member.repository";
import { FARM_MEMBER_REPOSITORY } from "./repositories/farm-member.repository.interface";
import { FarmMembersService } from "./services/farm-members.service";
import { FARM_MEMBERS_SERVICE } from "./services/farm-members.service.interface";
import { FarmMembersController } from "./farm-members.controller";

@Module({
  imports: [PrismaModule, SubscriptionsModule, AuthModule],
  controllers: [FarmMembersController],
  providers: [
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
