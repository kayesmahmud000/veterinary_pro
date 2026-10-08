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
    private readonly piiCryptoService: PiiCryptoService,
  ) {}

  public async lockById(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<UserEntity | null> {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    return this.findById(id, { includeDeleted: true }, tx);
  }
  public async listAdministrative(filter: {
    limit: number;
    cursor?: string;
    role?: UserRole;
    search?: string;
  }) {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: filter.role ?? { in: ["ADMIN", "SUPER_ADMIN"] },
        ...(filter.search
          ? {
              OR: [
                { email: { contains: filter.search, mode: "insensitive" } },
                { name: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        roleVersion: true,
      },
      orderBy: { id: "asc" },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return {
      users: rows.slice(0, filter.limit).map((u) => ({
        ...u,
        role: u.role as UserRole,
        status: u.status as UserStatus,
      })),
      nextCursor:
        rows.length > filter.limit ? rows[filter.limit - 1]!.id : null,
    };
  }
  public async recordLogin(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
  public async saveRole(
    user: UserEntity,
    expectedRoleVersion: number,
    tx: Prisma.TransactionClient,
  ): Promise<UserEntity> {
    const result = await tx.user.updateMany({
      where: { id: user.id, roleVersion: expectedRoleVersion },
      data: {
        role: user.role,
        roleVersion: user.roleVersion,
        authorizationVersion: user.authorizationVersion,
        previousNonAdministrativeRole: user.previousNonAdministrativeRole,
        farmerOnboardingRequired: user.farmerOnboardingRequired,
      },
    });
    if (result.count !== 1)
      throw new EntityConflictException(
        "Role changed. Reload and retry.",
        "roleVersion",
      );
    return (await this.findById(user.id, undefined, tx))!;
  }
  public async invalidateSessions(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.user.update({
      where: { id },
      data: { authorizationVersion: { increment: 1 } },
    });
  }
  public async lockAdministrativePolicy(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100471)::text`;
  }
  public async countActiveSuperAdmins(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    return tx.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
    });
  }

  public async create(
    user: UserEntity,
    tx?: Prisma.TransactionClient,
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
          roleVersion: user.roleVersion,
          authorizationVersion: user.authorizationVersion,
          previousNonAdministrativeRole: user.previousNonAdministrativeRole,
          farmerOnboardingRequired: user.farmerOnboardingRequired,
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
            "email",
          );
        }
        if (target.includes("phone_hash") || target.includes("phoneHash")) {
          throw new EntityConflictException(
            "A user with this phone number already exists.",
            "phone",
          );
        }
        throw new EntityConflictException(
          "User unique constraint conflict.",
          target.join(", "),
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    options?: FindUserOptions,
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
              "email",
            );
          }
          if (target.includes("phone_hash") || target.includes("phoneHash")) {
            throw new EntityConflictException(
              "A user with this phone number already exists.",
              "phone",
            );
          }
          throw new EntityConflictException(
            "User unique constraint conflict.",
            target.join(", "),
          );
        }
      }
      throw error;
    }
  }

  public async softDelete(
    id: string,
    deletedAt = new Date(),
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
    tx?: Prisma.TransactionClient,
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
    row: Prisma.UserGetPayload<Record<string, never>>,
  ): UserEntity {
    let decryptedPhone: string | null = null;
    if (row.phone) {
      try {
        decryptedPhone = this.piiCryptoService.decrypt(row.phone);
      } catch (err) {
        this.logger.warn(
          `Unable to decrypt phone for user ${row.id}; setting to null.`,
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
      roleVersion: row.roleVersion,
      authorizationVersion: row.authorizationVersion,
      previousNonAdministrativeRole:
        row.previousNonAdministrativeRole as UserRole | null,
      farmerOnboardingRequired: row.farmerOnboardingRequired,
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
