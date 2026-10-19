import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PayoutLedgerQueryDto,
  PayoutStatus,
  PlatformRevenueSummaryDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import { WorkflowException } from "../../../common/exceptions/domain.exception";
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
        updatedAt: entity.updatedAt,
      },
      include: LEDGER_INCLUDE,
    });

    return this.toEntity(record);
  }

  public async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity | null> {
    const record = await (
      tx ?? this.prisma
    ).consultationPayoutLedger.findUnique({
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
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity | null> {
    const record = await (
      tx ?? this.prisma
    ).consultationPayoutLedger.findUnique({
      where: { consultationId },
      include: LEDGER_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async lockConsultations(
    ids: string[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!ids.length) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM consultations WHERE id IN (${Prisma.join([...new Set(ids)].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
    );
  }

  public async lockForProcessing(
    ids: string[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const rows = await tx.consultationPayoutLedger.findMany({
      where: { id: { in: ids } },
      select: { consultationId: true },
    });
    await this.lockConsultations(
      rows.map((row) => row.consultationId),
      tx,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM consultation_payout_ledgers WHERE id IN (${Prisma.join([...ids].sort().map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
    );
  }

  public async lockProcessingActor(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`,
    );
    const actor = await tx.user.findUnique({
      where: { id },
      select: { role: true, status: true, deletedAt: true },
    });
    return (
      !!actor &&
      !actor.deletedAt &&
      actor.status === "ACTIVE" &&
      ["ADMIN", "SUPER_ADMIN"].includes(actor.role)
    );
  }

  public findConsultationForSettlement(
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.consultation.findUnique({
      where: { id },
      select: {
        id: true,
        vetId: true,
        farmerId: true,
        farmId: true,
        type: true,
        status: true,
        paymentStatus: true,
        feeCents: true,
        currency: true,
      },
    });
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

  public async findPendingByVetId(
    vetId: string,
  ): Promise<PayoutLedgerEntity[]> {
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

  public async findEarningsSummary(
    vetId: string,
  ): Promise<VetEarningsSummaryDto> {
    const summary = await this.aggregateSingleCurrency({ vetId });
    return {
      vetId,
      lifetimeGrossCents: summary.gross,
      lifetimePlatformFeeCents: summary.fees,
      lifetimeVetEarningsCents: summary.earnings,
      pendingPayoutCents: summary.pending,
      paidPayoutCents: summary.paid,
      totalSettledConsultations: summary.count,
      currency: summary.currency,
    };
  }

  public async findPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto> {
    const where: Prisma.ConsultationPayoutLedgerWhereInput = {};
    if (filter?.startDate || filter?.endDate) {
      where.createdAt = {
        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
        ...(filter.endDate ? { lte: new Date(filter.endDate) } : {}),
      };
    }
    const summary = await this.aggregateSingleCurrency(where);
    return {
      totalGrossVolumeCents: summary.gross,
      totalPlatformFeesEarnedCents: summary.fees,
      totalVetPayoutsOwedCents: summary.owed,
      totalVetPayoutsPaidCents: summary.paid,
      totalSettledConsultations: summary.count,
      currency: summary.currency,
    };
  }

  private async aggregateSingleCurrency(
    where: Prisma.ConsultationPayoutLedgerWhereInput,
  ) {
    const rows = await this.prisma.consultationPayoutLedger.groupBy({
      by: ["currency", "status"],
      where,
      _count: { _all: true },
      _sum: {
        totalFeeCents: true,
        platformFeeCents: true,
        vetPayoutCents: true,
      },
    });
    const currency = rows[0]?.currency ?? "USD";
    if (rows.some((row) => row.currency !== currency)) {
      throw new WorkflowException(
        "SETTLEMENT_MIXED_CURRENCY",
        "Legacy summaries require a single currency. Use the administrative grouped summary.",
      );
    }
    const result = {
      currency,
      count: 0,
      gross: 0,
      fees: 0,
      earnings: 0,
      pending: 0,
      paid: 0,
      owed: 0,
    };
    for (const row of rows) {
      const earnings = row._sum.vetPayoutCents ?? 0;
      result.count += row._count._all;
      result.gross += row._sum.totalFeeCents ?? 0;
      result.fees += row._sum.platformFeeCents ?? 0;
      result.earnings += earnings;
      if (
        row.status === PayoutStatus.PENDING ||
        row.status === PayoutStatus.PROCESSING
      )
        result.pending += earnings;
      if (row.status === PayoutStatus.PAID) result.paid += earnings;
      else if (row.status !== PayoutStatus.REVERSED) result.owed += earnings;
    }
    if (
      Object.entries(result).some(
        ([key, value]) =>
          key !== "currency" &&
          (!Number.isSafeInteger(value) || Number(value) < 0),
      )
    ) {
      throw new WorkflowException(
        "SETTLEMENT_ACTION_UNAVAILABLE",
        "Invalid financial aggregate.",
      );
    }
    return result;
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
