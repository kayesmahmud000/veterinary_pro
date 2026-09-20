export interface SyncStatusDto {
  farmId: string;
  serverTimestamp: number;
  entityCounts: {
    animals: number;
    milkLogs: number;
    healthRecords: number;
    vaccineRecords: number;
    weightLogs: number;
    transactions: number;
  };
}
