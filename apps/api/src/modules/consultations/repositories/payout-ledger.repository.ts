import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PayoutLedgerQueryDto,
  PayoutStatus,
  PlatformRevenueSummaryDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";
import { IPayoutLedgerRepository } from "./payout-ledger.repository.interface";

const LEDGER_INCLUDE = {
  vet: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  consultation: {
    select: {
      id: true,
      chiefComplaint: true,
      type: true,
      feeCents: true,
      farmId: true,
      farmerId: true,
    },
  },
} as const;

@Injectable()
export class PayoutLedgerRepository implements IPayoutLedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: PayoutLedgerEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationPayoutLedger.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        vetId: entity.vetId,
        totalFeeCents: entity.totalFeeCents,
        platformFeeRate: new Prisma.Decimal(entity.platformFeeRate),
        platformFeeCents: entity.platformFeeCents,
        vetPayoutCents: entity.vetPayoutCents,
        currency: entity.currency,
        status: entity.status,
        payoutBatchId: entity.payoutBatchId,
        payoutReference: entity.payoutReference,
        processedAt: entity.processedAt,
        metadata: entity.metadata as Prisma.InputJsonValue,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: LEDGER_INCLUDE,
    });

    return this.toEntity(record);
  }

  public async save(
    entity: PayoutLedgerEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationPayoutLedger.update({
      where: { id: entity.id },
      data: {
        status: entity.status,
        payoutBatchId: entity.payoutBatchId,
        payoutReference: entity.payoutReference,
        processedAt: entity.processedAt,
        metadata: entity.metadata as Prisma.InputJsonValue,
        updatedAt: entity.updatedAt,
      },
      include: LEDGER_INCLUDE,
    });

    return this.toEntity(record);
  }

  public async findById(id: string): Promise<PayoutLedgerEntity | null> {
    const record = await this.prisma.consultationPayoutLedger.findUnique({
      where: { id },
      include: LEDGER_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findByConsultationId(
    consultationId: string,
  ): Promise<PayoutLedgerEntity | null> {
    const record = await this.prisma.consultationPayoutLedger.findUnique({
      where: { consultationId },
      include: LEDGER_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findMany(
    query: PayoutLedgerQueryDto,
  ): Promise<{ items: PayoutLedgerEntity[]; total: number }> {
    const where: Prisma.ConsultationPayoutLedgerWhereInput = {};

    if (query.vetId) {
      where.vetId = query.vetId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.payoutBatchId) {
      where.payoutBatchId = query.payoutBatchId;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.consultationPayoutLedger.findMany({
        where,
        include: LEDGER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.consultationPayoutLedger.count({ where }),
    ]);

    return {
      items: records.map((r) => this.toEntity(r)),
      total,
    };
  }

  public async findPendingByVetId(vetId: string): Promise<PayoutLedgerEntity[]> {
    const records = await this.prisma.consultationPayoutLedger.findMany({
      where: {
        vetId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      },
      include: LEDGER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return records.map((r) => this.toEntity(r));
  }

  public async findEarningsSummary(vetId: string): Promise<VetEarningsSummaryDto> {
    const records = await this.prisma.consultationPayoutLedger.findMany({
      where: { vetId },
    });

    let lifetimeGrossCents = 0;
    let lifetimePlatformFeeCents = 0;
    let lifetimeVetEarningsCents = 0;
    let pendingPayoutCents = 0;
    let paidPayoutCents = 0;
    const currency = records[0]?.currency ?? "USD";

    for (const r of records) {
      lifetimeGrossCents += r.totalFeeCents;
      lifetimePlatformFeeCents += r.platformFeeCents;
      lifetimeVetEarningsCents += r.vetPayoutCents;

      if (r.status === PayoutStatus.PENDING || r.status === PayoutStatus.PROCESSING) {
        pendingPayoutCents += r.vetPayoutCents;
      } else if (r.status === PayoutStatus.PAID) {
        paidPayoutCents += r.vetPayoutCents;
      }
    }

    return {
      vetId,
      lifetimeGrossCents,
      lifetimePlatformFeeCents,
      lifetimeVetEarningsCents,
      pendingPayoutCents,
      paidPayoutCents,
      totalSettledConsultations: records.length,
      currency,
    };
  }

  public async findPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto> {
    const where: Prisma.ConsultationPayoutLedgerWhereInput = {};

    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.createdAt.lte = new Date(filter.endDate);
      }
    }

    const records = await this.prisma.consultationPayoutLedger.findMany({
      where,
    });

    let totalGrossVolumeCents = 0;
    let totalPlatformFeesEarnedCents = 0;
    let totalVetPayoutsOwedCents = 0;
    let totalVetPayoutsPaidCents = 0;
    const currency = records[0]?.currency ?? "USD";

    for (const r of records) {
      totalGrossVolumeCents += r.totalFeeCents;
      totalPlatformFeesEarnedCents += r.platformFeeCents;

      if (r.status === PayoutStatus.PAID) {
        totalVetPayoutsPaidCents += r.vetPayoutCents;
      } else if (r.status !== PayoutStatus.REVERSED) {
        totalVetPayoutsOwedCents += r.vetPayoutCents;
      }
    }

    return {
      totalGrossVolumeCents,
      totalPlatformFeesEarnedCents,
      totalVetPayoutsOwedCents,
      totalVetPayoutsPaidCents,
      totalSettledConsultations: records.length,
      currency,
    };
  }

  private toEntity(record: any): PayoutLedgerEntity {
    return PayoutLedgerEntity.fromPersistence({
      id: record.id,
      consultationId: record.consultationId,
      vetId: record.vetId,
      totalFeeCents: record.totalFeeCents,
      platformFeeRate: Number(record.platformFeeRate),
      platformFeeCents: record.platformFeeCents,
      vetPayoutCents: record.vetPayoutCents,
      currency: record.currency,
      status: record.status as PayoutStatus,
      payoutBatchId: record.payoutBatchId,
      payoutReference: record.payoutReference,
      processedAt: record.processedAt,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      vet: record.vet,
      consultation: record.consultation,
    });
  }
}
