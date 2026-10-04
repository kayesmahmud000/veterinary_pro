import {
  SyncAnimalDto,
  SyncHealthRecordDto,
  SyncMilkLogDto,
  SyncTransactionDto,
  SyncVaccineRecordDto,
  SyncWeightLogDto,
} from "./sync-entities.dto.js";

export type SyncConflictResolution = "SERVER_WINS" | "CLIENT_APPLIED";

export interface SyncConflictItemDto {
  table: string;
  recordId: string;
  reason: string;
  resolution: SyncConflictResolution;
  serverVersion?: number;
  clientVersion?: number;
}

export interface SyncPushTableChangesDto<T> {
  created?: T[];
  updated?: T[];
  deleted?: string[];
}

export interface SyncPushTableChangesMap {
  animals?: SyncPushTableChangesDto<SyncAnimalDto>;
  milkLogs?: SyncPushTableChangesDto<SyncMilkLogDto>;
  healthRecords?: SyncPushTableChangesDto<SyncHealthRecordDto>;
  vaccineRecords?: SyncPushTableChangesDto<SyncVaccineRecordDto>;
  weightLogs?: SyncPushTableChangesDto<SyncWeightLogDto>;
  transactions?: SyncPushTableChangesDto<SyncTransactionDto>;
}

export interface SyncPushRequestDto {
  farmId: string;
  lastPulledAt: number;
  changes: SyncPushTableChangesMap;
}

export interface SyncPushResponseDto {
  success: boolean;
  serverTimestamp: number;
  appliedCounts: {
    animals: number;
    milkLogs: number;
    healthRecords: number;
    vaccineRecords: number;
    weightLogs: number;
    transactions: number;
  };
  conflicts: SyncConflictItemDto[];
}
