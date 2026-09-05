import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FarmRole } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import { IFarmMemberRepository } from "./farm-member.repository.interface";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class FarmMemberRepository implements IFarmMemberRepository {
  private readonly logger = new Logger(FarmMemberRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async findMembership(
    farmId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.farmMember.findFirst({
      where: {
        farmId,
        userId,
        farm: {
          deletedAt: null,
        },
      },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findUserFarms(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity[]> {
    const client = tx ?? this.prisma;

    const rows = await client.farmMember.findMany({
      where: {
        userId,
        farm: {
          deletedAt: null,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => this.toEntity(r));
  }

  public async create(
    member: FarmMemberEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity> {
    const client = tx ?? this.prisma;

    try {
      const created = await client.farmMember.create({
        data: {
          id: member.id,
          farmId: member.farmId,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt,
        },
      });

      return this.toEntity(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          "User is already a member of this farm.",
          "farmId, userId"
        );
      }
      throw error;
    }
  }

  private toEntity(
    row: Prisma.FarmMemberGetPayload<Record<string, never>>
  ): FarmMemberEntity {
    return FarmMemberEntity.reconstitute({
      id: row.id,
      farmId: row.farmId,
      userId: row.userId,
      role: row.role as FarmRole,
      createdAt: row.createdAt,
    });
  }
}
