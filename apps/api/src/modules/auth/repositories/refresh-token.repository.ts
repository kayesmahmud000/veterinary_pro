import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import { IRefreshTokenRepository } from "./refresh-token.repository.interface";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  private readonly logger = new Logger(RefreshTokenRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    token: RefreshTokenEntity,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity> {
    const client = tx ?? this.prisma;

    try {
      const created = await client.refreshToken.create({
        data: {
          id: token.id,
          userId: token.userId,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
          revokedAt: token.revokedAt,
          ipAddress: token.ipAddress,
          userAgent: token.userAgent,
          createdAt: token.createdAt,
        },
      });

      return this.toEntity(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          "A refresh token with this hash already exists.",
          "tokenHash"
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.refreshToken.findUnique({
      where: { id },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findByTokenHash(
    tokenHash: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findActiveByUserId(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity[]> {
    const client = tx ?? this.prisma;
    const now = new Date();

    const rows = await client.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => this.toEntity(r));
  }

  public async revoke(
    id: string,
    revokedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    try {
      await client.refreshToken.update({
        where: { id },
        data: { revokedAt },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new EntityNotFoundException("RefreshToken", id);
      }
      throw error;
    }
  }

  public async revokeByTokenHash(
    tokenHash: string,
    revokedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }

  public async revokeAllForUser(
    userId: string,
    revokedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const result = await client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt },
    });

    return result.count;
  }

  public async deleteExpiredTokens(
    beforeDate = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const result = await client.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: beforeDate },
      },
    });

    return result.count;
  }

  private toEntity(
    row: Prisma.RefreshTokenGetPayload<Record<string, never>>
  ): RefreshTokenEntity {
    return RefreshTokenEntity.reconstitute({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    });
  }
}
