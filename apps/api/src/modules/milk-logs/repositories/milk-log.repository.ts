import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MilkSession } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { MilkLogEntity } from "../entities/milk-log.entity";
import {
  IMilkLogRepository,
  MilkLogAnalyticsFilter,
  MilkLogExportFilter,
  MilkLogQueryFilter,
} from "./milk-log.repository.interface";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

type MilkLogWithRelations = Prisma.MilkLogGetPayload<{
  include: {
    animal: {
      select: {
        id: true;
        tagNumber: true;
        name: true;
        species: true;
        breed: true;
      };
    };
    recordedBy: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

const defaultInclude = {
  animal: {
    select: {
      id: true,
      tagNumber: true,
      name: true,
      species: true,
      breed: true,
    },
  },
  recordedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

@Injectable()
export class MilkLogRepository implements IMilkLogRepository {
  private readonly logger = new Logger(MilkLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: MilkLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity> {
    const client = tx ?? this.prisma;

    try {
      const created = await client.milkLog.create({
        data: {
          id: entity.id,
          farmId: entity.farmId,
          animalId: entity.animalId,
          recordedById: entity.recordedById,
          session: entity.session,
          yieldLiters: new Prisma.Decimal(entity.yieldLiters),
          fatPercent:
            entity.fatPercent !== null && entity.fatPercent !== undefined
              ? new Prisma.Decimal(entity.fatPercent)
              : null,
          snfPercent:
            entity.snfPercent !== null && entity.snfPercent !== undefined
              ? new Prisma.Decimal(entity.snfPercent)
              : null,
          loggedDate: entity.loggedDate,
          syncVersion: entity.syncVersion,
        },
        include: defaultInclude,
      });

      return this.toDomain(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          `Milk log already exists for animal on this date and session (${entity.session}).`
        );
      }
      throw error;
    }
  }

  public async update(
    entity: MilkLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity> {
    const client = tx ?? this.prisma;

    try {
      const updated = await client.milkLog.update({
        where: {
          id: entity.id,
          farmId: entity.farmId,
        },
        data: {
          session: entity.session,
          yieldLiters: new Prisma.Decimal(entity.yieldLiters),
          fatPercent:
            entity.fatPercent !== null && entity.fatPercent !== undefined
              ? new Prisma.Decimal(entity.fatPercent)
              : null,
          snfPercent:
            entity.snfPercent !== null && entity.snfPercent !== undefined
              ? new Prisma.Decimal(entity.snfPercent)
              : null,
          loggedDate: entity.loggedDate,
          syncVersion: entity.syncVersion,
          updatedAt: new Date(),
        },
        include: defaultInclude,
      });

      return this.toDomain(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          `Cannot update milk log: duplicate record exists for this date and session.`
        );
      }
      throw error;
    }
  }

  public async delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.milkLog.delete({
      where: {
        id,
        farmId,
      },
    });
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.milkLog.findFirst({
      where: {
        id,
        farmId,
      },
      include: defaultInclude,
    });

    return row ? this.toDomain(row) : null;
  }

  public async findBySessionAndDate(
    farmId: string,
    animalId: string,
    loggedDate: Date,
    session: MilkSession,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.milkLog.findFirst({
      where: {
        farmId,
        animalId,
        loggedDate,
        session,
      },
      include: defaultInclude,
    });

    return row ? this.toDomain(row) : null;
  }

  public async findBulkBySessionAndDate(
    farmId: string,
    loggedDate: Date,
    session: MilkSession,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity | null> {
    const client = tx ?? this.prisma;
    const row = await client.milkLog.findFirst({
      where: {
        farmId,
        animalId: null,
        loggedDate,
        session,
      },
      include: defaultInclude,
    });

    return row ? this.toDomain(row) : null;
  }

  public async findMany(
    farmId: string,
    filter: MilkLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: MilkLogEntity[]; total: number }> {
    const client = tx ?? this.prisma;
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    let animalIdCondition: Prisma.StringNullableFilter | string | null | undefined = filter.animalId;
    if (!filter.animalId) {
      if (filter.entryType === "BULK") {
        animalIdCondition = null;
      } else if (filter.entryType === "INDIVIDUAL") {
        animalIdCondition = { not: null };
      }
    }

    const where: Prisma.MilkLogWhereInput = {
      farmId,
      ...(animalIdCondition !== undefined ? { animalId: animalIdCondition } : {}),
      ...(filter.session ? { session: filter.session } : {}),
      ...(filter.startDate || filter.endDate
        ? {
            loggedDate: {
              ...(filter.startDate ? { gte: filter.startDate } : {}),
              ...(filter.endDate ? { lte: filter.endDate } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.MilkLogOrderByWithRelationInput[] = [];
    if (filter.sortBy === "yieldLiters") {
      orderBy.push({ yieldLiters: filter.sortOrder ?? "desc" });
    } else if (filter.sortBy === "createdAt") {
      orderBy.push({ createdAt: filter.sortOrder ?? "desc" });
    } else {
      orderBy.push({ loggedDate: filter.sortOrder ?? "desc" });
      orderBy.push({ session: "asc" });
    }

    const [rows, total] = await Promise.all([
      client.milkLog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: defaultInclude,
      }),
      client.milkLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  public async findLogsForAnalytics(
    farmId: string,
    filter: MilkLogAnalyticsFilter,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity[]> {
    const client = tx ?? this.prisma;

    let animalIdCondition:
      | Prisma.StringNullableFilter
      | string
      | null
      | undefined = filter.animalId;
    if (!filter.animalId) {
      if (filter.entryType === "BULK") {
        animalIdCondition = null;
      } else if (filter.entryType === "INDIVIDUAL") {
        animalIdCondition = { not: null };
      }
    }

    const where: Prisma.MilkLogWhereInput = {
      farmId,
      ...(animalIdCondition !== undefined ? { animalId: animalIdCondition } : {}),
      loggedDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };

    const rows = await client.milkLog.findMany({
      where,
      orderBy: [{ loggedDate: "asc" }, { session: "asc" }],
      include: defaultInclude,
    });

    return rows.map((r) => this.toDomain(r));
  }

  public async findLogsForExport(
    farmId: string,
    filter: MilkLogExportFilter,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity[]> {
    const client = tx ?? this.prisma;
    const limit = Math.min(10000, Math.max(1, filter.limit ?? 5000));

    let animalIdCondition:
      | Prisma.StringNullableFilter
      | string
      | null
      | undefined = filter.animalId;
    if (!filter.animalId) {
      if (filter.entryType === "BULK") {
        animalIdCondition = null;
      } else if (filter.entryType === "INDIVIDUAL") {
        animalIdCondition = { not: null };
      }
    }

    const where: Prisma.MilkLogWhereInput = {
      farmId,
      ...(animalIdCondition !== undefined ? { animalId: animalIdCondition } : {}),
      ...(filter.session ? { session: filter.session } : {}),
      ...(filter.startDate || filter.endDate
        ? {
            loggedDate: {
              ...(filter.startDate ? { gte: filter.startDate } : {}),
              ...(filter.endDate ? { lte: filter.endDate } : {}),
            },
          }
        : {}),
    };

    const rows = await client.milkLog.findMany({
      where,
      take: limit,
      orderBy: [{ loggedDate: "asc" }, { session: "asc" }],
      include: defaultInclude,
    });

    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: MilkLogWithRelations): MilkLogEntity {
    return new MilkLogEntity({
      id: row.id,
      farmId: row.farmId,
      animalId: row.animalId,
      recordedById: row.recordedById,
      session: row.session as MilkSession,
      yieldLiters: Number(row.yieldLiters),
      fatPercent: row.fatPercent ? Number(row.fatPercent) : null,
      snfPercent: row.snfPercent ? Number(row.snfPercent) : null,
      loggedDate: row.loggedDate,
      syncVersion: row.syncVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      animal: row.animal
        ? {
            id: row.animal.id,
            tagNumber: row.animal.tagNumber,
            name: row.animal.name,
            species: row.animal.species,
            breed: row.animal.breed,
          }
        : null,
      recordedBy: row.recordedBy
        ? {
            id: row.recordedBy.id,
            name: row.recordedBy.name,
            email: row.recordedBy.email,
          }
        : null,
    });
  }
}
