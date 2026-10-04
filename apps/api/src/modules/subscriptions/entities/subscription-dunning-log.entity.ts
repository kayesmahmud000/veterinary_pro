import {
  DunningChannel,
  DunningStage,
  DunningStatus,
  SubscriptionDunningLogDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface SubscriptionDunningLogEntityProps {
  id: string;
  subscriptionId: string;
  userId: string;
  farmId: string | null;
  stage: DunningStage;
  channel: DunningChannel;
  status: DunningStatus;
  recipientEmail: string;
  subject: string;
  message: string;
  errorMessage: string | null;
  attemptCount: number;
  gatewayInvoiceId: string | null;
  dispatchedDate: string;
  dispatchedAt: Date;
}

export interface CreateSubscriptionDunningLogProps {
  id?: string;
  subscriptionId: string;
  userId: string;
  farmId?: string | null;
  stage: DunningStage;
  channel?: DunningChannel;
  status?: DunningStatus;
  recipientEmail: string;
  subject: string;
  message: string;
  errorMessage?: string | null;
  attemptCount?: number;
  gatewayInvoiceId?: string | null;
  dispatchedDate?: string;
  dispatchedAt?: Date;
}

export class SubscriptionDunningLogEntity {
  private readonly _id: string;
  private readonly _subscriptionId: string;
  private readonly _userId: string;
  private readonly _farmId: string | null;
  private readonly _stage: DunningStage;
  private readonly _channel: DunningChannel;
  private _status: DunningStatus;
  private readonly _recipientEmail: string;
  private readonly _subject: string;
  private readonly _message: string;
  private _errorMessage: string | null;
  private _attemptCount: number;
  private readonly _gatewayInvoiceId: string | null;
  private readonly _dispatchedDate: string;
  private readonly _dispatchedAt: Date;

  private constructor(props: SubscriptionDunningLogEntityProps) {
    this._id = props.id;
    this._subscriptionId = props.subscriptionId;
    this._userId = props.userId;
    this._farmId = props.farmId;
    this._stage = props.stage;
    this._channel = props.channel;
    this._status = props.status;
    this._recipientEmail = props.recipientEmail;
    this._subject = props.subject;
    this._message = props.message;
    this._errorMessage = props.errorMessage;
    this._attemptCount = props.attemptCount;
    this._gatewayInvoiceId = props.gatewayInvoiceId;
    this._dispatchedDate = props.dispatchedDate;
    this._dispatchedAt = props.dispatchedAt;
  }

  public static create(props: CreateSubscriptionDunningLogProps): SubscriptionDunningLogEntity {
    if (!props.subscriptionId) {
      throw new ValidationDomainException("Subscription ID is required for dunning log");
    }
    if (!props.userId) {
      throw new ValidationDomainException("User ID is required for dunning log");
    }
    if (!props.stage) {
      throw new ValidationDomainException("Dunning stage is required");
    }
    if (!props.recipientEmail || !props.recipientEmail.includes("@")) {
      throw new ValidationDomainException("Valid recipient email is required");
    }
    if (!props.subject) {
      throw new ValidationDomainException("Subject is required");
    }
    if (!props.message) {
      throw new ValidationDomainException("Message content is required");
    }

    const now = props.dispatchedAt ?? new Date();
    const dispatchedDate = props.dispatchedDate ?? now.toISOString().slice(0, 10);

    return new SubscriptionDunningLogEntity({
      id: props.id ?? crypto.randomUUID(),
      subscriptionId: props.subscriptionId,
      userId: props.userId,
      farmId: props.farmId ?? null,
      stage: props.stage,
      channel: props.channel ?? DunningChannel.EMAIL,
      status: props.status ?? DunningStatus.SENT,
      recipientEmail: props.recipientEmail,
      subject: props.subject,
      message: props.message,
      errorMessage: props.errorMessage ?? null,
      attemptCount: props.attemptCount ?? 1,
      gatewayInvoiceId: props.gatewayInvoiceId ?? null,
      dispatchedDate,
      dispatchedAt: now,
    });
  }

  public static fromPersistence(raw: {
    id: string;
    subscriptionId: string;
    userId: string;
    farmId: string | null;
    stage: DunningStage | string;
    channel: DunningChannel | string;
    status: DunningStatus | string;
    recipientEmail: string;
    subject: string;
    message: string;
    errorMessage: string | null;
    attemptCount: number;
    gatewayInvoiceId: string | null;
    dispatchedDate: string;
    dispatchedAt: Date;
  }): SubscriptionDunningLogEntity {
    return new SubscriptionDunningLogEntity({
      id: raw.id,
      subscriptionId: raw.subscriptionId,
      userId: raw.userId,
      farmId: raw.farmId,
      stage: raw.stage as DunningStage,
      channel: raw.channel as DunningChannel,
      status: raw.status as DunningStatus,
      recipientEmail: raw.recipientEmail,
      subject: raw.subject,
      message: raw.message,
      errorMessage: raw.errorMessage,
      attemptCount: raw.attemptCount,
      gatewayInvoiceId: raw.gatewayInvoiceId,
      dispatchedDate: raw.dispatchedDate,
      dispatchedAt:
        raw.dispatchedAt instanceof Date
          ? raw.dispatchedAt
          : new Date(raw.dispatchedAt),
    });
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get subscriptionId(): string {
    return this._subscriptionId;
  }

  public get userId(): string {
    return this._userId;
  }

  public get farmId(): string | null {
    return this._farmId;
  }

  public get stage(): DunningStage {
    return this._stage;
  }

  public get channel(): DunningChannel {
    return this._channel;
  }

  public get status(): DunningStatus {
    return this._status;
  }

  public get recipientEmail(): string {
    return this._recipientEmail;
  }

  public get subject(): string {
    return this._subject;
  }

  public get message(): string {
    return this._message;
  }

  public get errorMessage(): string | null {
    return this._errorMessage;
  }

  public get attemptCount(): number {
    return this._attemptCount;
  }

  public get gatewayInvoiceId(): string | null {
    return this._gatewayInvoiceId;
  }

  public get dispatchedDate(): string {
    return this._dispatchedDate;
  }

  public get dispatchedAt(): Date {
    return this._dispatchedAt;
  }

  // State mutations
  public markSent(): void {
    this._status = DunningStatus.SENT;
    this._errorMessage = null;
  }

  public markFailed(errorMsg: string): void {
    this._status = DunningStatus.FAILED;
    this._errorMessage = errorMsg;
  }

  public incrementAttempt(): void {
    this._attemptCount += 1;
  }

  public toDto(): SubscriptionDunningLogDto {
    return {
      id: this._id,
      subscriptionId: this._subscriptionId,
      userId: this._userId,
      farmId: this._farmId,
      stage: this._stage,
      channel: this._channel,
      status: this._status,
      recipientEmail: this._recipientEmail,
      subject: this._subject,
      message: this._message,
      errorMessage: this._errorMessage,
      attemptCount: this._attemptCount,
      gatewayInvoiceId: this._gatewayInvoiceId,
      dispatchedDate: this._dispatchedDate,
      dispatchedAt: this._dispatchedAt.toISOString(),
    };
  }
}
