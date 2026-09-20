import {
  JwtPayload,
  SyncPullResponseDto,
  SyncPushRequestDto,
  SyncPushResponseDto,
  SyncStatusDto,
} from "@vetralink/shared-types";

export interface ISyncService {
  pull(
    user: JwtPayload,
    farmId: string,
    lastPulledAt?: number | string | null
  ): Promise<SyncPullResponseDto>;

  push(
    user: JwtPayload,
    dto: SyncPushRequestDto,
    traceId?: string
  ): Promise<SyncPushResponseDto>;

  getStatus(user: JwtPayload, farmId: string): Promise<SyncStatusDto>;
}

export const SYNC_SERVICE = Symbol("SYNC_SERVICE");
