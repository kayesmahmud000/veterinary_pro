import {
  PayoutLedgerQueryDto,
  PlatformRevenueSummaryDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import { Prisma } from "@prisma/client";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";

export interface IPayoutLedgerRepository {
  create(
    entity: PayoutLedgerEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity>;
  save(
    entity: PayoutLedgerEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity>;
  findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity | null>;
  findByConsultationId(
    consultationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayoutLedgerEntity | null>;
  lockForProcessing(ids: string[], tx: Prisma.TransactionClient): Promise<void>;
  lockConsultations(ids: string[], tx: Prisma.TransactionClient): Promise<void>;
  lockProcessingActor(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean>;
  findConsultationForSettlement(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    vetId: string | null;
    farmerId: string;
    farmId: string;
    type: string;
    status: string;
    paymentStatus: string;
    feeCents: number;
    currency: string;
  } | null>;
  findMany(
    query: PayoutLedgerQueryDto,
  ): Promise<{ items: PayoutLedgerEntity[]; total: number }>;
  findPendingByVetId(vetId: string): Promise<PayoutLedgerEntity[]>;
  findEarningsSummary(vetId: string): Promise<VetEarningsSummaryDto>;
  findPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto>;
}

export const PAYOUT_LEDGER_REPOSITORY = "PAYOUT_LEDGER_REPOSITORY";
