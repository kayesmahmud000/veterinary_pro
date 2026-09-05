import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma";
import { FarmMemberRepository } from "./repositories/farm-member.repository";
import { FARM_MEMBER_REPOSITORY } from "./repositories/farm-member.repository.interface";

@Module({
  imports: [PrismaModule],
  providers: [
    FarmMemberRepository,
    {
      provide: FARM_MEMBER_REPOSITORY,
      useClass: FarmMemberRepository,
    },
  ],
  exports: [FarmMemberRepository, FARM_MEMBER_REPOSITORY],
})
export class FarmsModule {}
