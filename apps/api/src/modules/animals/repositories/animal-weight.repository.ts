import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalWeightLogEntity } from "../entities/animal-weight-log.entity";
import {
  IAnimalWeightRepository,
  WeightQueryOptions,
} from "./animal-weight.repository.interface";

@Injectable()
export class AnimalWeightRepository implements IAnimalWeightRepository {
  private readonly logger = new Logger(AnimalWeightRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    log: AnimalWeightLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity> {
    const client = tx ?? this.prisma;

    const created = await client.animalWeightLog.create({
      data: {
        id: log.id,
        farmId: log.farmId,
        animalId: log.animalId,
        recordedById: log.recordedById,
        weightKg: new Prisma.Decimal(log.weightKg),
        recordedAt: log.recordedAt,
        notes: log.notes,
        syncVersion: log.syncVersion,
      },
      include: {
        recordedBy: { select: { name: true } },
      },
    });

    return this.toEntity(created);
  }

  public async findByAnimalId(
    animalId: string,
    farmId: string,
    options?: WeightQueryOptions,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: AnimalWeightLogEntity[]; total: number }> {
    const client = tx ?? this.prisma;
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AnimalWeightLogWhereInput = {
      animalId,
      farmId,
      ...(options?.startDate || options?.endDate
        ? {
            recordedAt: {
              ...(options?.startDate && { gte: options.startDate }),
              ...(options?.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      client.animalWeightLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { recordedAt: "desc" },
        include: {
          recordedBy: { select: { name: true } },
        },
      }),
      client.animalWeightLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toEntity(r)),
      total,
    };
  }

  public async findAllChronological(
    animalId: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity[]> {
    const client = tx ?? this.prisma;

    const rows = await client.animalWeightLog.findMany({
      where: {
        animalId,
        farmId,
      },
      orderBy: { recordedAt: "asc" },
      include: {
        recordedBy: { select: { name: true } },
      },
    });

    return rows.map((r) => this.toEntity(r));
  }

  public async findLatestByAnimalId(
    animalId: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity | null> {
    const client = tx ?? this.prisma;

    const latest = await client.animalWeightLog.findFirst({
      where: {
        animalId,
        farmId,
      },
      orderBy: { recordedAt: "desc" },
      include: {
        recordedBy: { select: { name: true } },
      },
    });

    return latest ? this.toEntity(latest) : null;
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.animalWeightLog.findFirst({
      where: {
        id,
        farmId,
      },
      include: {
        recordedBy: { select: { name: true } },
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;

    const result = await client.animalWeightLog.deleteMany({
      where: {
        id,
        farmId,
      },
    });

    return result.count > 0;
  }

  private toEntity(row: {
    id: string;
    farmId: string;
    animalId: string;
    recordedById: string;
    weightKg: Prisma.Decimal | number;
    recordedAt: Date;
    notes: string | null;
    syncVersion: number;
    createdAt: Date;
    updatedAt: Date;
    recordedBy?: { name: string | null } | null;
  }): AnimalWeightLogEntity {
    return AnimalWeightLogEntity.reconstitute({
      id: row.id,
      farmId: row.farmId,
      animalId: row.animalId,
      recordedById: row.recordedById,
      weightKg:
        typeof row.weightKg === "number"
          ? row.weightKg
          : Number(row.weightKg),
      recordedAt: row.recordedAt,
      notes: row.notes,
      recordedByName: row.recordedBy?.name ?? null,
      syncVersion: row.syncVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
