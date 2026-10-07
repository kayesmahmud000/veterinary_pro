import { Inject, Injectable } from "@nestjs/common";
import {
  FarmOnboardingInput,
  farmOnboardingSchema,
  UserRole,
} from "@vetralink/shared-types";
import { validateWorkflow } from "../../../common/utils/validate-workflow";
import { randomUUID } from "crypto";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../../users/repositories/user.repository.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { FarmOnboardingRepository } from "../repositories/farm-onboarding.repository";
import {
  ForbiddenOperationException,
  WorkflowException,
} from "../../../common/exceptions/domain.exception";
import { canonicalHash } from "../../../common/utils/workflow";

@Injectable()
export class FarmOnboardingService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly farms: FarmOnboardingRepository,
  ) {}
  async status(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || user.isSuspended()) throw new ForbiddenOperationException();
    return {
      required: user.role === UserRole.FARMER && user.farmerOnboardingRequired,
      farms: await this.farms.farms(userId),
    };
  }
  async complete(userId: string, input: FarmOnboardingInput) {
    input = validateWorkflow(farmOnboardingSchema, input);
    const payloadHash = canonicalHash(input);
    return this.transactions.run(async (tx) => {
      const user = await this.users.lockById(userId, tx);
      if (!user?.isActive() || user.role !== UserRole.FARMER)
        throw new ForbiddenOperationException();
      const previous = await this.farms.findCompleted(userId, tx);
      if (
        !user.farmerOnboardingRequired &&
        previous?.submissionKey === input.submissionKey
      ) {
        if (previous.payloadHash !== payloadHash)
          throw new WorkflowException(
            "SUBMISSION_KEY_CONFLICT",
            "The submission key was already used with different details.",
          );
        return { required: false, farms: await this.farms.farms(userId, tx) };
      }
      if (!user.farmerOnboardingRequired)
        throw new WorkflowException(
          "ONBOARDING_ALREADY_COMPLETE",
          "Farm onboarding is already complete.",
        );
      let farmId: string;
      if (input.mode === "create")
        farmId = await this.farms.createFarm(userId, input, tx);
      else {
        const memberships = await this.farms.farms(userId, tx);
        if (!memberships.some((f) => f.id === input.farmId))
          throw new ForbiddenOperationException("You cannot join this farm.");
        farmId = input.farmId;
      }
      await this.farms.complete(
        userId,
        farmId,
        input.submissionKey,
        payloadHash,
        tx,
      );
      await this.audit.record(
        {
          userId,
          action: "FARM_ONBOARDING_COMPLETED",
          entityType: "Farm",
          entityId: farmId,
          newValues: { mode: input.mode },
          traceId: randomUUID(),
        },
        tx,
      );
      return { required: false, farms: await this.farms.farms(userId, tx) };
    });
  }
}
