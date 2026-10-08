import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AddFarmMemberInput,
  FarmMemberListDto,
  FarmMemberResponseDto,
  FarmRole,
  addFarmMemberSchema,
  JwtPayload,
  UserRole,
  SubscriptionQuotaType,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  ForbiddenOperationException,
} from "../../../common/exceptions/domain.exception";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../../users/repositories/user.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ISubscriptionQuotaService,
  SUBSCRIPTION_QUOTA_SERVICE,
} from "../../subscriptions/services/subscription-quota.service.interface";
import { FarmOnboardingRepository } from "../repositories/farm-onboarding.repository";
import { randomUUID } from "crypto";
import { validateWorkflow } from "../../../common/utils/validate-workflow";
import { FarmMemberEntity } from "../entities/farm-member.entity";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../repositories/farm-member.repository.interface";
import { IFarmMembersService } from "./farm-members.service.interface";

@Injectable()
export class FarmMembersService implements IFarmMembersService {
  private readonly logger = new Logger(FarmMembersService.name);

  constructor(
    @Inject(FARM_MEMBER_REPOSITORY)
    private readonly memberRepo: IFarmMemberRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    @Inject(SUBSCRIPTION_QUOTA_SERVICE)
    private readonly quota: ISubscriptionQuotaService,
    private readonly farms: FarmOnboardingRepository,
  ) {}

  public async addMember(
    farmId: string,
    dto: AddFarmMemberInput,
    actor: JwtPayload,
  ): Promise<FarmMemberResponseDto> {
    dto = validateWorkflow(addFarmMemberSchema, dto);
    const targetId =
      dto.userId ?? (await this.users.findByEmail(dto.email!))?.id;
    if (!targetId)
      throw new ForbiddenOperationException(
        "An active account with this email is required.",
      );
    return this.transactions.run(async (tx) => {
      const lockedUsers = new Map();
      for (const userId of [...new Set([actor.sub, targetId])].sort())
        lockedUsers.set(userId, await this.users.lockById(userId, tx));
      const currentActor = lockedUsers.get(actor.sub);
      const target = lockedUsers.get(targetId);
      if (dto.email && target?.email !== dto.email)
        throw new ForbiddenOperationException(
          "Member account changed. Retry with the current email.",
        );
      if (
        !currentActor?.isActive() ||
        !target?.isActive() ||
        currentActor.role === UserRole.LEARNER ||
        (currentActor.role === UserRole.FARMER &&
          currentActor.farmerOnboardingRequired)
      )
        throw new ForbiddenOperationException(
          "Active professional account and target are required.",
        );
      if (!(await this.farms.lockFarm(farmId, tx)))
        throw new ForbiddenOperationException("Farm is unavailable.");
      const caller = await this.memberRepo.findMembership(
        farmId,
        actor.sub,
        tx,
      );
      if (!caller || ![FarmRole.OWNER, FarmRole.MANAGER].includes(caller.role))
        throw new ForbiddenOperationException(
          "Owner or manager access is required.",
        );
      if (dto.role === FarmRole.OWNER && caller.role !== FarmRole.OWNER)
        throw new ForbiddenOperationException(
          "Only an owner can add another owner.",
        );
      const existing = await this.memberRepo.findMembership(
        farmId,
        targetId,
        tx,
      );
      if (existing) {
        throw new EntityConflictException(
          "This account is already a farm member.",
          "userId",
        );
      }

      const memberEntity = FarmMemberEntity.create({
        farmId,
        userId: targetId,
        role: dto.role ?? FarmRole.HERDSMAN,
      });

      await this.quota.assertQuotaAvailable(
        farmId,
        SubscriptionQuotaType.STAFF,
      );
      const saved = await this.memberRepo.create(memberEntity, tx);
      await this.audit.record(
        {
          userId: actor.sub,
          action: "FARM_MEMBER_ADDED",
          entityType: "FarmMember",
          entityId: saved.id,
          newValues: { farmId, userId: saved.userId, role: saved.role },
          traceId: randomUUID(),
        },
        tx,
      );

      this.logger.log(
        `Added member '${saved.userId}' with role '${saved.role}' to farm '${farmId}'.`,
      );

      return this.toDto(saved);
    });
  }

  public async getMembers(farmId: string): Promise<FarmMemberListDto> {
    const members = await this.farms.memberSummaries(farmId);
    return {
      items: members,
      total: members.length,
    };
  }

  private toDto(entity: FarmMemberEntity): FarmMemberResponseDto {
    return {
      id: entity.id,
      farmId: entity.farmId,
      userId: entity.userId,
      role: entity.role,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
