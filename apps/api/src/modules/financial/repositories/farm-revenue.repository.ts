import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  TransactionCategory as PrismaTransactionCategory,
  TransactionType as PrismaTransactionType,
} from "@prisma/client";
import {
  AnimalSpecies,
  RevenueCategorySummaryDto,
  RevenueSummaryResponseDto,
  RevenueTimelineItemDto,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmRevenueEntity } from "../entities/farm-revenue.entity";
import {
  FarmRevenueQueryFilter,
  FarmRevenueSummaryFilter,
  IFarmRevenueRepository,
} from "./farm-revenue.repository.interface";

type FarmTransactionWithRelations = Prisma.FarmTransactionGetPayload<{
  include: {
    animal: {
      select: {
        id: true;
        tagNumber: true;
        name: true;
        species: true;
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
export class FarmRevenueRepository implements IFarmRevenueRepository {
  private readonly logger = new Logger(FarmRevenueRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity> {
    const client = tx ?? this.prisma;

    const record = await client.farmTransaction.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        recordedById: entity.recordedById,
        animalId: entity.animalId,
        type: entity.type as unknown as PrismaTransactionType,
        category: entity.category as unknown as PrismaTransactionCategory,
        amount: new Prisma.Decimal(entity.amount),
        currency: entity.currency,
        referenceNote: entity.referenceNote,
        receiptUrl: entity.receiptUrl,
        metadata: entity.metadata as Prisma.InputJsonValue,
        txDate: entity.txDate,
        syncVersion: entity.syncVersion,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
      include: defaultInclude,
    });

    return this.toDomain(record);
  }

  public async update(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity> {
    const client = tx ?? this.prisma;

    const record = await client.farmTransaction.update({
      where: { id: entity.id },
      data: {
        animalId: entity.animalId,
        category: entity.category as unknown as PrismaTransactionCategory,
        amount: new Prisma.Decimal(entity.amount),
        currency: entity.currency,
        referenceNote: entity.referenceNote,
        receiptUrl: entity.receiptUrl,
        metadata: entity.metadata as Prisma.InputJsonValue,
        txDate: entity.txDate,
        syncVersion: entity.syncVersion,
        updatedAt: entity.updatedAt,
        deletedAt: entity.deletedAt,
      },
      include: defaultInclude,
    });

    return this.toDomain(record);
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity | null> {
    const client = tx ?? this.prisma;

    const record = await client.farmTransaction.findFirst({
      where: {
        id,
        farmId,
        type: PrismaTransactionType.INCOME,
        deletedAt: null,
      },
      include: defaultInclude,
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  public async findMany(
    filter: FarmRevenueQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: FarmRevenueEntity[]; total: number }> {
    const client = tx ?? this.prisma;

    const where: Prisma.FarmTransactionWhereInput = {
      farmId: filter.farmId,
      type: PrismaTransactionType.INCOME,
      deletedAt: null,
    };

    if (filter.startDate || filter.endDate) {
      where.txDate = {};
      if (filter.startDate) {
        where.txDate.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.txDate.lte = filter.endDate;
      }
    }

    if (filter.category) {
      where.category = filter.category as unknown as PrismaTransactionCategory;
    }

    if (filter.animalId) {
      where.animalId = filter.animalId;
    }

    if (filter.search && filter.search.trim()) {
      where.referenceNote = {
        contains: filter.search.trim(),
        mode: "insensitive",
      };
    }

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const sortBy = filter.sortBy ?? "txDate";
    const sortOrder = filter.sortOrder ?? "desc";

    const [total, records] = await Promise.all([
      client.farmTransaction.count({ where }),
      client.farmTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: defaultInclude,
      }),
    ]);

    return {
      items: records.map((r) => this.toDomain(r)),
      total,
    };
  }

  public async getSummary(
    filter: FarmRevenueSummaryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<RevenueSummaryResponseDto> {
    const client = tx ?? this.prisma;

    const where: Prisma.FarmTransactionWhereInput = {
      farmId: filter.farmId,
      type: PrismaTransactionType.INCOME,
      deletedAt: null,
      txDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };

    if (filter.animalId) {
      where.animalId = filter.animalId;
    }

    const records = await client.farmTransaction.findMany({
      where,
      select: {
        amount: true,
        category: true,
        currency: true,
        txDate: true,
      },
      orderBy: {
        txDate: "asc",
      },
    });

    let totalRevenue = 0;
    const currency = records[0]?.currency ?? "USD";
    const categoryMap = new Map<
      TransactionCategory,
      { totalAmount: number; transactionCount: number }
    >();
    const timelineMap = new Map<
      string,
      { amount: number; transactionCount: number }
    >();

    for (const rec of records) {
      const amt = Number(rec.amount);
      totalRevenue += amt;

      const cat = rec.category as unknown as TransactionCategory;
      const catEntry = categoryMap.get(cat) ?? {
        totalAmount: 0,
        transactionCount: 0,
      };
      catEntry.totalAmount += amt;
      catEntry.transactionCount += 1;
      categoryMap.set(cat, catEntry);

      const dateKey = rec.txDate.toISOString().split("T")[0]!;
      const timelineEntry = timelineMap.get(dateKey) ?? {
        amount: 0,
        transactionCount: 0,
      };
      timelineEntry.amount += amt;
      timelineEntry.transactionCount += 1;
      timelineMap.set(dateKey, timelineEntry);
    }

    totalRevenue = Math.round(totalRevenue * 100) / 100;

    let topCategory: TransactionCategory | null = null;
    let highestCatAmount = -1;

    const byCategory: RevenueCategorySummaryDto[] = [];
    for (const [cat, data] of categoryMap.entries()) {
      const roundedAmount = Math.round(data.totalAmount * 100) / 100;
      const percentage =
        totalRevenue > 0
          ? Math.round((roundedAmount / totalRevenue) * 10000) / 100
          : 0;

      byCategory.push({
        category: cat,
        totalAmount: roundedAmount,
        transactionCount: data.transactionCount,
        percentage,
      });

      if (roundedAmount > highestCatAmount) {
        highestCatAmount = roundedAmount;
        topCategory = cat;
      }
    }

    byCategory.sort((a, b) => b.totalAmount - a.totalAmount);

    const timeline: RevenueTimelineItemDto[] = Array.from(
      timelineMap.entries()
    ).map(([date, val]) => ({
      date,
      amount: Math.round(val.amount * 100) / 100,
      transactionCount: val.transactionCount,
    }));

    return {
      startDate: filter.startDate.toISOString().split("T")[0]!,
      endDate: filter.endDate.toISOString().split("T")[0]!,
      currency,
      totalRevenue,
      totalTransactions: records.length,
      topCategory,
      byCategory,
      timeline,
    };
  }

  public async softDelete(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.farmTransaction.update({
      where: { id: entity.id },
      data: {
        deletedAt: entity.deletedAt,
        syncVersion: entity.syncVersion,
        updatedAt: entity.updatedAt,
      },
    });
  }

  private toDomain(record: FarmTransactionWithRelations): FarmRevenueEntity {
    return new FarmRevenueEntity({
      id: record.id,
      farmId: record.farmId,
      recordedById: record.recordedById,
      animalId: record.animalId,
      type: record.type as unknown as TransactionType,
      category: record.category as unknown as TransactionCategory,
      amount: Number(record.amount),
      currency: record.currency,
      referenceNote: record.referenceNote,
      receiptUrl: record.receiptUrl,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      txDate: record.txDate,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      recordedBy: record.recordedBy
        ? {
            id: record.recordedBy.id,
            name: record.recordedBy.name,
            email: record.recordedBy.email,
          }
        : null,
      animal: record.animal
        ? {
            id: record.animal.id,
            tagNumber: record.animal.tagNumber,
            name: record.animal.name,
            species: record.animal.species as unknown as AnimalSpecies,
          }
        : null,
    });
  }
}
