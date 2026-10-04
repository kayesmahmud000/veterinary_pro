import {
  SyncConflictItemDto,
  SyncPullChangesMap,
  SyncPushTableChangesMap,
} from "@vetralink/shared-types";

export interface ISyncRepository {
  pullFarmDeltas(farmId: string, since: Date | null): Promise<SyncPullChangesMap>;

  applyPushMutations(
    farmId: string,
    userId: string,
    changes: SyncPushTableChangesMap,
    clientLastPulledAt: Date
  ): Promise<{
    appliedCounts: {
      animals: number;
      milkLogs: number;
      healthRecords: number;
      vaccineRecords: number;
      weightLogs: number;
      transactions: number;
    };
    conflicts: SyncConflictItemDto[];
  }>;

  getFarmSyncSummary(farmId: string): Promise<{
    animals: number;
    milkLogs: number;
    healthRecords: number;
    vaccineRecords: number;
    weightLogs: number;
    transactions: number;
  }>;
}

export const SYNC_REPOSITORY = Symbol("SYNC_REPOSITORY");
