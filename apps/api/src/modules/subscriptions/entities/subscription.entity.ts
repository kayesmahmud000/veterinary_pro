import { SubscriptionStatus } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionResponseDto } from "../dto/subscription-response.dto";
import { SubscriptionPlanEntity } from "./subscription-plan.entity";

export interface SubscriptionEntityProps {
  id: string;
  userId: string;
  farmId: string | null;
  planId: string;
  plan?: SubscriptionPlanEntity | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gatewaySubId: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTrialSubscriptionProps {
  id?: string;
  userId: string;
  farmId?: string | null;
  planId: string;
  plan?: SubscriptionPlanEntity | null;
  trialDays?: number;
  now?: Date;
}

export interface CreateActiveSubscriptionProps {
  id?: string;
  userId: string;
  farmId?: string | null;
  planId: string;
  plan?: SubscriptionPlanEntity | null;
  periodEnd: Date;
  gatewaySubId?: string | null;
  now?: Date;
}

export class SubscriptionEntity {
  private readonly _id: string;
  private readonly _userId: string;
  private _farmId: string | null;
  private _planId: string;
  private _plan: SubscriptionPlanEntity | null;
  private _status: SubscriptionStatus;
  private _currentPeriodStart: Date;
  private _currentPeriodEnd: Date;
  private _gatewaySubId: string | null;
  private _cancelAtPeriodEnd: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: SubscriptionEntityProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._farmId = props.farmId;
    this._planId = props.planId;
    this._plan = props.plan ?? null;
    this._status = props.status;
    this._currentPeriodStart = props.currentPeriodStart;
    this._currentPeriodEnd = props.currentPeriodEnd;
    this._gatewaySubId = props.gatewaySubId;
    this._cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static createTrial(props: CreateTrialSubscriptionProps): SubscriptionEntity {
    if (!props.userId) {
      throw new ValidationDomainException("User ID is required to create a subscription");
    }
    if (!props.planId) {
      throw new ValidationDomainException("Plan ID is required to create a subscription");
    }

    const trialDays = props.trialDays ?? 14;
    if (trialDays < 1) {
      throw new ValidationDomainException("Trial days must be at least 1 day");
    }

    const startDate = props.now ?? new Date();
    const endDate = new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000);

    return new SubscriptionEntity({
      id: props.id ?? crypto.randomUUID(),
      userId: props.userId,
      farmId: props.farmId ?? null,
      planId: props.planId,
      plan: props.plan ?? null,
      status: SubscriptionStatus.TRIALING,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      gatewaySubId: null,
      cancelAtPeriodEnd: false,
      createdAt: startDate,
      updatedAt: startDate,
    });
  }

  public static createActive(props: CreateActiveSubscriptionProps): SubscriptionEntity {
    if (!props.userId) {
      throw new ValidationDomainException("User ID is required to create a subscription");
    }
    if (!props.planId) {
      throw new ValidationDomainException("Plan ID is required to create a subscription");
    }

    const startDate = props.now ?? new Date();
    if (props.periodEnd <= startDate) {
      throw new ValidationDomainException("Period end date must be after current period start");
    }

    return new SubscriptionEntity({
      id: props.id ?? crypto.randomUUID(),
      userId: props.userId,
      farmId: props.farmId ?? null,
      planId: props.planId,
      plan: props.plan ?? null,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: startDate,
      currentPeriodEnd: props.periodEnd,
      gatewaySubId: props.gatewaySubId ?? null,
      cancelAtPeriodEnd: false,
      createdAt: startDate,
      updatedAt: startDate,
    });
  }

  public static fromPersistence(raw: {
    id: string;
    userId: string;
    farmId: string | null;
    planId: string;
    status: SubscriptionStatus | string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    gatewaySubId: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
    plan?: any;
  }): SubscriptionEntity {
    const planEntity = raw.plan
      ? SubscriptionPlanEntity.fromPersistence(raw.plan)
      : null;

    return new SubscriptionEntity({
      id: raw.id,
      userId: raw.userId,
      farmId: raw.farmId,
      planId: raw.planId,
      plan: planEntity,
      status: raw.status as SubscriptionStatus,
      currentPeriodStart:
        raw.currentPeriodStart instanceof Date
          ? raw.currentPeriodStart
          : new Date(raw.currentPeriodStart),
      currentPeriodEnd:
        raw.currentPeriodEnd instanceof Date
          ? raw.currentPeriodEnd
          : new Date(raw.currentPeriodEnd),
      gatewaySubId: raw.gatewaySubId,
      cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
      createdAt:
        raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
      updatedAt:
        raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
    });
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get farmId(): string | null {
    return this._farmId;
  }

  public get planId(): string {
    return this._planId;
  }

  public get plan(): SubscriptionPlanEntity | null {
    return this._plan;
  }

  public get status(): SubscriptionStatus {
    return this._status;
  }

  public get currentPeriodStart(): Date {
    return this._currentPeriodStart;
  }

  public get currentPeriodEnd(): Date {
    return this._currentPeriodEnd;
  }

  public get gatewaySubId(): string | null {
    return this._gatewaySubId;
  }

  public get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  // Domain Predicates
  public isPeriodExpired(now: Date = new Date()): boolean {
    return now.getTime() > this._currentPeriodEnd.getTime();
  }

  public isActive(now: Date = new Date()): boolean {
    if (this._status === SubscriptionStatus.ACTIVE) {
      return !this.isPeriodExpired(now);
    }
    if (this._status === SubscriptionStatus.TRIALING) {
      return !this.isPeriodExpired(now);
    }
    return false;
  }

  public isInTrial(now: Date = new Date()): boolean {
    return this._status === SubscriptionStatus.TRIALING && !this.isPeriodExpired(now);
  }

  public isPastDue(): boolean {
    return this._status === SubscriptionStatus.PAST_DUE;
  }

  public isCanceled(): boolean {
    return (
      this._status === SubscriptionStatus.CANCELED ||
      this._status === SubscriptionStatus.EXPIRED
    );
  }

  public isPastGracePeriod(now: Date = new Date(), graceDays: number = 3): boolean {
    const graceMs = graceDays * 24 * 60 * 60 * 1000;
    return now.getTime() > this._currentPeriodEnd.getTime() + graceMs;
  }

  public canAccessService(now: Date = new Date()): boolean {
    if (this.isActive(now)) {
      return true;
    }
    // Allow service access during past-due grace period before total cutoff
    if (this.isPastDue() && !this.isPastGracePeriod(now, 3)) {
      return true;
    }
    return false;
  }

  public daysRemaining(now: Date = new Date()): number {
    const msRemaining = this._currentPeriodEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  }

  // Domain State Transitions
  public activate(params?: { periodEnd?: Date; gatewaySubId?: string; now?: Date }): void {
    if (this._status === SubscriptionStatus.CANCELED) {
      throw new ValidationDomainException(
        "Cannot activate an immediately canceled subscription. Create a new subscription instead.",
      );
    }

    const now = params?.now ?? new Date();
    this._status = SubscriptionStatus.ACTIVE;
    this._cancelAtPeriodEnd = false;

    if (params?.periodEnd) {
      if (params.periodEnd <= now) {
        throw new ValidationDomainException("New period end must be in the future");
      }
      this._currentPeriodEnd = params.periodEnd;
    }

    if (params?.gatewaySubId !== undefined) {
      this._gatewaySubId = params.gatewaySubId;
    }

    this._updatedAt = now;
  }

  public markPastDue(now: Date = new Date()): void {
    if (this._status === SubscriptionStatus.CANCELED) {
      throw new ValidationDomainException("Cannot mark a canceled subscription as past due");
    }
    if (this._status === SubscriptionStatus.EXPIRED) {
      throw new ValidationDomainException("Cannot mark an expired subscription as past due");
    }

    this._status = SubscriptionStatus.PAST_DUE;
    this._updatedAt = now;
  }

  public requestCancellation(params: { immediate: boolean; now?: Date }): void {
    const now = params.now ?? new Date();

    if (this.isCanceled()) {
      return; // Idempotent
    }

    if (params.immediate) {
      this._status = SubscriptionStatus.CANCELED;
      this._cancelAtPeriodEnd = false;
    } else {
      this._cancelAtPeriodEnd = true;
    }

    this._updatedAt = now;
  }

  public revokeCancellation(now: Date = new Date()): void {
    if (this._status === SubscriptionStatus.CANCELED) {
      throw new ValidationDomainException("Cannot revoke immediate cancellation");
    }
    if (!this._cancelAtPeriodEnd) {
      throw new ValidationDomainException("Subscription does not have a pending cancellation");
    }
    if (this.isPeriodExpired(now)) {
      throw new ValidationDomainException("Cannot revoke cancellation after the subscription period has expired");
    }

    this._cancelAtPeriodEnd = false;
    this._updatedAt = now;
  }

  public expire(now: Date = new Date()): void {
    this._status = SubscriptionStatus.EXPIRED;
    this._cancelAtPeriodEnd = false;
    this._updatedAt = now;
  }

  public renew(newPeriodEnd: Date, gatewaySubId?: string, now: Date = new Date()): void {
    if (newPeriodEnd <= this._currentPeriodEnd) {
      throw new ValidationDomainException("Renewal period end must be after current period end");
    }

    this._currentPeriodStart = this._currentPeriodEnd;
    this._currentPeriodEnd = newPeriodEnd;
    this._status = SubscriptionStatus.ACTIVE;
    this._cancelAtPeriodEnd = false;

    if (gatewaySubId !== undefined) {
      this._gatewaySubId = gatewaySubId;
    }

    this._updatedAt = now;
  }

  public attachPlan(plan: SubscriptionPlanEntity): void {
    this._plan = plan;
    this._planId = plan.id;
  }

  public linkFarm(farmId: string): void {
    this._farmId = farmId;
    this._updatedAt = new Date();
  }

  public toResponseDto(): SubscriptionResponseDto {
    const now = new Date();
    return {
      id: this._id,
      userId: this._userId,
      farmId: this._farmId,
      planId: this._planId,
      plan: this._plan ? this._plan.toResponseDto() : undefined,
      status: this._status,
      currentPeriodStart: this._currentPeriodStart.toISOString(),
      currentPeriodEnd: this._currentPeriodEnd.toISOString(),
      gatewaySubId: this._gatewaySubId,
      cancelAtPeriodEnd: this._cancelAtPeriodEnd,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      isActive: this.isActive(now),
      isTrial: this.isInTrial(now),
      isPastDue: this.isPastDue(),
      daysRemaining: this.daysRemaining(now),
    };
  }
}
