import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  JwtPayload,
  SyncPullResponseDto,
  SyncPushRequestDto,
  SyncPushResponseDto,
  SyncStatusDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../../farms/repositories/farm-member.repository.interface";
import {
  ISyncRepository,
  SYNC_REPOSITORY,
} from "../repositories/sync.repository.interface";
import { ISyncService } from "./sync.service.interface";

@Injectable()
export class SyncService implements ISyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(SYNC_REPOSITORY)
    private readonly syncRepo: ISyncRepository,
    @Inject(FARM_MEMBER_REPOSITORY)
    private readonly farmMemberRepo: IFarmMemberRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  public async pull(
    user: JwtPayload,
    farmId: string,
    lastPulledAt?: number | string | null
  ): Promise<SyncPullResponseDto> {
    await this.assertFarmAccess(user, farmId);

    let since: Date | null = null;
    if (lastPulledAt !== undefined && lastPulledAt !== null) {
      since = new Date(lastPulledAt);
      if (isNaN(since.getTime())) {
        throw new ValidationDomainException(
          "Invalid lastPulledAt watermark timestamp. Expected Unix epoch milliseconds or ISO-8601 string."
        );
      }
    }

    this.logger.log(
      `User '${user.sub}' initiating sync pull for farm '${farmId}' (since: ${since ? since.toISOString() : "INITIAL_FULL_SYNC"})`
    );

    const changes = await this.syncRepo.pullFarmDeltas(farmId, since);
    const serverTimestamp = Date.now();

    return {
      farmId,
      serverTimestamp,
      changes,
    };
  }

  public async push(
    user: JwtPayload,
    dto: SyncPushRequestDto,
    traceId?: string
  ): Promise<SyncPushResponseDto> {
    await this.assertFarmAccess(user, dto.farmId);

    const clientLastPulledAt = new Date(dto.lastPulledAt);
    if (isNaN(clientLastPulledAt.getTime())) {
      throw new ValidationDomainException(
        "Invalid lastPulledAt watermark timestamp in push payload."
      );
    }

    this.logger.log(
      `User '${user.sub}' executing batch sync push for farm '${dto.farmId}' (client watermark: ${clientLastPulledAt.toISOString()})`
    );

    const result = await this.syncRepo.applyPushMutations(
      dto.farmId,
      user.sub,
      dto.changes,
      clientLastPulledAt
    );

    const activeTraceId = traceId ?? crypto.randomUUID();

    // Emitting audit log for offline sync mutations
    await this.auditLogRepo.record({
      userId: user.sub,
      action: "OFFLINE_SYNC_PUSHED",
      entityType: "Farm",
      entityId: dto.farmId,
      newValues: {
        appliedCounts: result.appliedCounts,
        conflictCount: result.conflicts.length,
      },
      traceId: activeTraceId,
    });

    return {
      success: true,
      serverTimestamp: Date.now(),
      appliedCounts: result.appliedCounts,
      conflicts: result.conflicts,
    };
  }

  public async getStatus(
    user: JwtPayload,
    farmId: string
  ): Promise<SyncStatusDto> {
    await this.assertFarmAccess(user, farmId);

    const entityCounts = await this.syncRepo.getFarmSyncSummary(farmId);

    return {
      farmId,
      serverTimestamp: Date.now(),
      entityCounts,
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private async assertFarmAccess(
    user: JwtPayload,
    farmId: string
  ): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    const membership = await this.farmMemberRepo.findMembership(
      farmId,
      user.sub
    );

    if (!membership) {
      throw new ForbiddenOperationException(
        "Access denied: You are not a registered member of this farm tenant."
      );
    }
  }
}
