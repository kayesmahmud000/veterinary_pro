import { Prisma } from "@prisma/client";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";

export interface IRefreshTokenRepository {
  create(
    token: RefreshTokenEntity,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity>;

  findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity | null>;

  findByTokenHash(
    tokenHash: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity | null>;

  findActiveByUserId(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RefreshTokenEntity[]>;

  revoke(
    id: string,
    revokedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  revokeByTokenHash(
    tokenHash: string,
    revokedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  revokeAllForUser(
    userId: string,
    revokedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<number>;

  deleteExpiredTokens(
    beforeDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<number>;
}

export const REFRESH_TOKEN_REPOSITORY = "REFRESH_TOKEN_REPOSITORY";
