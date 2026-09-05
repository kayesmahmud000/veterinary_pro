import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { UserEntity } from "../entities/user.entity";
import {
  FindUserOptions,
  FindUsersFilter,
  IUserRepository,
} from "./user.repository.interface";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly piiCryptoService: PiiCryptoService
  ) {}

  public async create(
    user: UserEntity,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity> {
    const client = tx ?? this.prisma;

    let encryptedPhone: string | null = null;
    let phoneHash: string | null = user.phoneHash;

    if (user.phone) {
      encryptedPhone = this.piiCryptoService.encrypt(user.phone);
      if (!phoneHash) {
        phoneHash = this.piiCryptoService.hashPhone(user.phone);
      }
    }

    try {
      const created = await client.user.create({
        data: {
          id: user.id,
          email: user.email,
          phone: encryptedPhone,
          phoneHash: phoneHash,
          passwordHash: user.passwordHash,
          name: user.name,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        },
      });

      return this.toEntity(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes("email")) {
          throw new EntityConflictException(
            `A user with email '${user.email}' already exists.`,
            "email"
          );
        }
        if (target.includes("phone_hash") || target.includes("phoneHash")) {
          throw new EntityConflictException(
            "A user with this phone number already exists.",
            "phone"
          );
        }
        throw new EntityConflictException(
          "User unique constraint conflict.",
          target.join(", ")
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.user.findFirst({
      where: {
        id,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findByEmail(
    email: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null> {
    const client = tx ?? this.prisma;
    const normalizedEmail = email.toLowerCase().trim();

    const row = await client.user.findFirst({
      where: {
        email: normalizedEmail,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findByPhoneHash(
    phoneHash: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.user.findFirst({
      where: {
        phoneHash,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
    });

    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async update(
    user: UserEntity,
    tx?: Prisma.TransactionClient
  ): Promise<UserEntity> {
    const client = tx ?? this.prisma;

    let encryptedPhone: string | null = null;
    let phoneHash: string | null = user.phoneHash;

    if (user.phone) {
      encryptedPhone = this.piiCryptoService.encrypt(user.phone);
      if (!phoneHash) {
        phoneHash = this.piiCryptoService.hashPhone(user.phone);
      }
    }

    try {
      const updated = await client.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          phone: encryptedPhone,
          phoneHash: phoneHash,
          passwordHash: user.passwordHash,
          name: user.name,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        },
      });

      return this.toEntity(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new EntityNotFoundException("User", user.id);
        }
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[]) ?? [];
          if (target.includes("email")) {
            throw new EntityConflictException(
              `A user with email '${user.email}' already exists.`,
              "email"
            );
          }
          if (target.includes("phone_hash") || target.includes("phoneHash")) {
            throw new EntityConflictException(
              "A user with this phone number already exists.",
              "phone"
            );
          }
          throw new EntityConflictException(
            "User unique constraint conflict.",
            target.join(", ")
          );
        }
      }
      throw error;
    }
  }

  public async softDelete(
    id: string,
    deletedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    try {
      await client.user.update({
        where: { id },
        data: {
          deletedAt,
          updatedAt: deletedAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new EntityNotFoundException("User", id);
      }
      throw error;
    }
  }

  public async findMany(
    filter?: FindUsersFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: UserEntity[]; total: number }> {
    const client = tx ?? this.prisma;
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      ...(filter?.includeDeleted ? {} : { deletedAt: null }),
      ...(filter?.role ? { role: filter.role } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    };

    if (filter?.search && filter.search.trim().length > 0) {
      const searchTerm = filter.search.trim();
      where.OR = [
        { email: { contains: searchTerm, mode: "insensitive" } },
        { name: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      client.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      client.user.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toEntity(r)),
      total,
    };
  }

  public async existsByEmail(
    email: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    const count = await client.user.count({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
    return count > 0;
  }

  public async existsByPhoneHash(
    phoneHash: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    const count = await client.user.count({
      where: {
        phoneHash,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  private toEntity(
    row: Prisma.UserGetPayload<Record<string, never>>
  ): UserEntity {
    let decryptedPhone: string | null = null;
    if (row.phone) {
      try {
        decryptedPhone = this.piiCryptoService.decrypt(row.phone);
      } catch (err) {
        this.logger.warn(
          `Unable to decrypt phone for user ${row.id}; setting to null.`
        );
        decryptedPhone = null;
      }
    }

    return UserEntity.reconstitute({
      id: row.id,
      email: row.email,
      phone: decryptedPhone,
      phoneHash: row.phoneHash,
      passwordHash: row.passwordHash,
      name: row.name,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      avatarUrl: row.avatarUrl,
      isEmailVerified: row.isEmailVerified,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
