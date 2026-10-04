import { Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { UserEntity } from "../entities/user.entity";

export interface FindUserOptions {
  includeDeleted?: boolean;
}

export interface FindUsersFilter {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface IUserRepository {
  create(user: UserEntity, tx?: Prisma.TransactionClient): Promise<UserEntity>;

  findById(
    id: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null>;

  findByEmail(
    email: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null>;

  findByPhoneHash(
    phoneHash: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null>;

  update(user: UserEntity, tx?: Prisma.TransactionClient): Promise<UserEntity>;

  softDelete(
    id: string,
    deletedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  findMany(
    filter?: FindUsersFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: UserEntity[]; total: number }>;

  existsByEmail(
    email: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;

  existsByPhoneHash(
    phoneHash: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;
}

export const USER_REPOSITORY = "USER_REPOSITORY";
