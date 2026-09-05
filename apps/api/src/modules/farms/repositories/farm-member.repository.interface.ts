import { Prisma } from "@prisma/client";
import { FarmMemberEntity } from "../entities/farm-member.entity";

export interface IFarmMemberRepository {
  findMembership(
    farmId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity | null>;

  findUserFarms(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity[]>;

  create(
    member: FarmMemberEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity>;
}

export const FARM_MEMBER_REPOSITORY = "FARM_MEMBER_REPOSITORY";
