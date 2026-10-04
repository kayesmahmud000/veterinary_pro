import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { MilkYieldAnomalyEntity } from "../entities/milk-yield-anomaly.entity";
import {
  IMilkYieldAnomalyRepository,
  MilkAnomalyQueryFilter,
} from "./milk-yield-anomaly.repository.interface";

type AnomalyWithRelations = Prisma.MilkYieldAnomalyGetPayload<{
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
    acknowledgedBy: {
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
  acknowledgedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

@Injectable()
export class MilkYieldAnomalyRepository implements IMilkYieldAnomalyRepository {
  private readonly logger = new Logger(MilkYieldAnomalyRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async upsert(
    entity: MilkYieldAnomalyEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity> {
    const client = tx ?? this.prisma;

    const row = await client.milkYieldAnomaly.upsert({
      where: {
        farmId_animalId_loggedDate: {
          farmId: entity.farmId,
          animalId: entity.animalId,
          loggedDate: entity.loggedDate,
        },
      },
      create: {
        id: entity.id,
        farmId: entity.farmId,
        animalId: entity.animalId,
        loggedDate: entity.loggedDate,
        currentYieldLiters: new Prisma.Decimal(entity.currentYieldLiters),
        baselineYieldLiters: new Prisma.Decimal(entity.baselineYieldLiters),
        dropPercentage: new Prisma.Decimal(entity.dropPercentage),
        severity: entity.severity,
        status: entity.status,
        metadata: entity.metadata as Prisma.InputJsonValue,
      },
      update: {
        currentYieldLiters: new Prisma.Decimal(entity.currentYieldLiters),
        baselineYieldLiters: new Prisma.Decimal(entity.baselineYieldLiters),
        dropPercentage: new Prisma.Decimal(entity.dropPercentage),
        severity: entity.severity,
        metadata: entity.metadata as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: defaultInclude,
    });

    return this.toDomain(row);
  }

  public async save(
    entity: MilkYieldAnomalyEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity> {
    const client = tx ?? this.prisma;

    const row = await client.milkYieldAnomaly.update({
      where: {
        id: entity.id,
      },
      data: {
        status: entity.status,
        severity: entity.severity,
        currentYieldLiters: new Prisma.Decimal(entity.currentYieldLiters),
        baselineYieldLiters: new Prisma.Decimal(entity.baselineYieldLiters),
        dropPercentage: new Prisma.Decimal(entity.dropPercentage),
        acknowledgedById: entity.acknowledgedById,
        acknowledgedAt: entity.acknowledgedAt,
        resolvedAt: entity.resolvedAt,
        clinicalNotes: entity.clinicalNotes,
        resolutionNotes: entity.resolutionNotes,
        metadata: entity.metadata as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: defaultInclude,
    });

    return this.toDomain(row);
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.milkYieldAnomaly.findFirst({
      where: {
        id,
        farmId,
      },
      include: defaultInclude,
    });

    return row ? this.toDomain(row) : null;
  }

  public async findByAnimalAndDate(
    farmId: string,
    animalId: string,
    loggedDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.milkYieldAnomaly.findFirst({
      where: {
        farmId,
        animalId,
        loggedDate,
      },
      include: defaultInclude,
    });

    return row ? this.toDomain(row) : null;
  }

  public async findMany(
    farmId: string,
    filter: MilkAnomalyQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: MilkYieldAnomalyEntity[]; total: number }> {
    const client = tx ?? this.prisma;
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.MilkYieldAnomalyWhereInput = {
      farmId,
      ...(filter.animalId ? { animalId: filter.animalId } : {}),
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.startDate || filter.endDate
        ? {
            loggedDate: {
              ...(filter.startDate ? { gte: filter.startDate } : {}),
              ...(filter.endDate ? { lte: filter.endDate } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      client.milkYieldAnomaly.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ loggedDate: "desc" }, { createdAt: "desc" }],
        include: defaultInclude,
      }),
      client.milkYieldAnomaly.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  private toDomain(row: AnomalyWithRelations): MilkYieldAnomalyEntity {
    return new MilkYieldAnomalyEntity({
      id: row.id,
      farmId: row.farmId,
      animalId: row.animalId,
      loggedDate: row.loggedDate,
      currentYieldLiters: Number(row.currentYieldLiters),
      baselineYieldLiters: Number(row.baselineYieldLiters),
      dropPercentage: Number(row.dropPercentage),
      severity: row.severity as MilkAnomalySeverity,
      status: row.status as MilkAnomalyStatus,
      acknowledgedById: row.acknowledgedById,
      acknowledgedAt: row.acknowledgedAt,
      resolvedAt: row.resolvedAt,
      clinicalNotes: row.clinicalNotes,
      resolutionNotes: row.resolutionNotes,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
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
      acknowledgedBy: row.acknowledgedBy
        ? {
            id: row.acknowledgedBy.id,
            name: row.acknowledgedBy.name,
            email: row.acknowledgedBy.email,
          }
        : null,
    });
  }
}
