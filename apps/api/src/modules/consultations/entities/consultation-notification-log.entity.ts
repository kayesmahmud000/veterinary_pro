import {
  ConsultationNotificationChannel,
  ConsultationNotificationLogDto,
  ConsultationNotificationStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ConsultationNotificationLogEntityProps {
  id: string;
  consultationId: string;
  vetId: string;
  channel: ConsultationNotificationChannel;
  status: ConsultationNotificationStatus;
  title: string;
  message: string;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  dispatchedAt: Date;
}

export interface CreateConsultationNotificationLogProps {
  id?: string;
  consultationId: string;
  vetId: string;
  channel: ConsultationNotificationChannel;
  status?: ConsultationNotificationStatus;
  title: string;
  message: string;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  readAt?: Date | null;
  dispatchedAt?: Date;
}

export class ConsultationNotificationLogEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _vetId: string;
  private readonly _channel: ConsultationNotificationChannel;
  private _status: ConsultationNotificationStatus;
  private readonly _title: string;
  private readonly _message: string;
  private _errorMessage: string | null;
  private readonly _metadata: Record<string, unknown>;
  private _readAt: Date | null;
  private readonly _dispatchedAt: Date;

  private constructor(props: ConsultationNotificationLogEntityProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._vetId = props.vetId;
    this._channel = props.channel;
    this._status = props.status;
    this._title = props.title;
    this._message = props.message;
    this._errorMessage = props.errorMessage;
    this._metadata = props.metadata;
    this._readAt = props.readAt;
    this._dispatchedAt = props.dispatchedAt;
  }

  public static create(
    props: CreateConsultationNotificationLogProps,
  ): ConsultationNotificationLogEntity {
    if (!props.consultationId) {
      throw new ValidationDomainException(
        "Consultation ID is required for notification log.",
      );
    }
    if (!props.vetId) {
      throw new ValidationDomainException(
        "Veterinarian ID is required for notification log.",
      );
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new ValidationDomainException(
        "Notification title cannot be empty.",
      );
    }
    if (!props.message || props.message.trim().length === 0) {
      throw new ValidationDomainException(
        "Notification message cannot be empty.",
      );
    }

    return new ConsultationNotificationLogEntity({
      id: props.id ?? crypto.randomUUID(),
      consultationId: props.consultationId,
      vetId: props.vetId,
      channel: props.channel,
      status: props.status ?? ConsultationNotificationStatus.SENT,
      title: props.title.trim(),
      message: props.message.trim(),
      errorMessage: props.errorMessage ?? null,
      metadata: props.metadata ?? {},
      readAt: props.readAt ?? null,
      dispatchedAt: props.dispatchedAt ?? new Date(),
    });
  }

  public static fromPersistence(raw: {
    id: string;
    consultationId: string;
    vetId: string;
    channel: ConsultationNotificationChannel | string;
    status: ConsultationNotificationStatus | string;
    title: string;
    message: string;
    errorMessage: string | null;
    metadata: unknown;
    readAt: Date | null;
    dispatchedAt: Date;
  }): ConsultationNotificationLogEntity {
    return new ConsultationNotificationLogEntity({
      id: raw.id,
      consultationId: raw.consultationId,
      vetId: raw.vetId,
      channel: raw.channel as ConsultationNotificationChannel,
      status: raw.status as ConsultationNotificationStatus,
      title: raw.title,
      message: raw.message,
      errorMessage: raw.errorMessage,
      metadata: (raw.metadata as Record<string, unknown>) ?? {},
      readAt: raw.readAt,
      dispatchedAt: raw.dispatchedAt,
    });
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get vetId(): string {
    return this._vetId;
  }

  public get channel(): ConsultationNotificationChannel {
    return this._channel;
  }

  public get status(): ConsultationNotificationStatus {
    return this._status;
  }

  public get title(): string {
    return this._title;
  }

  public get message(): string {
    return this._message;
  }

  public get errorMessage(): string | null {
    return this._errorMessage;
  }

  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  public get readAt(): Date | null {
    return this._readAt;
  }

  public get dispatchedAt(): Date {
    return this._dispatchedAt;
  }

  public get isRead(): boolean {
    return this._readAt !== null;
  }

  // Domain invariants
  public markAsRead(at = new Date()): void {
    if (!this._readAt) {
      this._readAt = at;
    }
  }

  public markFailed(errorMessage: string): void {
    this._status = ConsultationNotificationStatus.FAILED;
    this._errorMessage = errorMessage;
  }

  public toDto(): ConsultationNotificationLogDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      vetId: this._vetId,
      channel: this._channel,
      status: this._status,
      title: this._title,
      message: this._message,
      errorMessage: this._errorMessage,
      metadata: this._metadata,
      readAt: this._readAt ? this._readAt.toISOString() : null,
      dispatchedAt: this._dispatchedAt.toISOString(),
    };
  }
}
