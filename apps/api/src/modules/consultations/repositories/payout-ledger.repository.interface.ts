import {
  PayoutLedgerQueryDto,
  PlatformRevenueSummaryDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";

export interface IPayoutLedgerRepository {
  create(entity: PayoutLedgerEntity): Promise<PayoutLedgerEntity>;
  save(entity: PayoutLedgerEntity): Promise<PayoutLedgerEntity>;
  findById(id: string): Promise<PayoutLedgerEntity | null>;
  findByConsultationId(consultationId: string): Promise<PayoutLedgerEntity | null>;
  findMany(query: PayoutLedgerQueryDto): Promise<{ items: PayoutLedgerEntity[]; total: number }>;
  findPendingByVetId(vetId: string): Promise<PayoutLedgerEntity[]>;
  findEarningsSummary(vetId: string): Promise<VetEarningsSummaryDto>;
  findPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto>;
}

export const PAYOUT_LEDGER_REPOSITORY = "PAYOUT_LEDGER_REPOSITORY";
