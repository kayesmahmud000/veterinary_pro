import {
  SyncAnimalDto,
  SyncHealthRecordDto,
  SyncMilkLogDto,
  SyncTransactionDto,
  SyncVaccineRecordDto,
  SyncWeightLogDto,
} from "./sync-entities.dto.js";

export interface SyncPullRequestDto {
  farmId: string;
  lastPulledAt?: number | string | null;
}

export interface SyncTableChangesDto<T> {
  created: T[];
  updated: T[];
  deleted: string[];
}

export interface SyncPullChangesMap {
  animals: SyncTableChangesDto<SyncAnimalDto>;
  milkLogs: SyncTableChangesDto<SyncMilkLogDto>;
  healthRecords: SyncTableChangesDto<SyncHealthRecordDto>;
  vaccineRecords: SyncTableChangesDto<SyncVaccineRecordDto>;
  weightLogs: SyncTableChangesDto<SyncWeightLogDto>;
  transactions: SyncTableChangesDto<SyncTransactionDto>;
}

export interface SyncPullResponseDto {
  farmId: string;
  serverTimestamp: number;
  changes: SyncPullChangesMap;
}
