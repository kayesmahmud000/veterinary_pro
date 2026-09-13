import {
  HealthEscalationLevel,
  HealthEscalationAction,
  ReminderChannel,
  ReminderStatus,
  HealthEscalationLogResponseDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface HealthEscalationLogProps {
  id: string;
  farmId: string;
  healthRecordId: string;
  animalId: string;
  level: HealthEscalationLevel;
  actionTaken: HealthEscalationAction;
  recipientUserId: string | null;
  recipientPhone: string | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  notes: string | null;
  hoursUnresolved: number;
  dispatchedAt: Date;
}

export class HealthEscalationLogEntity {
  private constructor(private readonly props: HealthEscalationLogProps) {
    this.validateInvariants();
  }

  public static create(
    params: Omit<HealthEscalationLogProps, "id" | "dispatchedAt"> & {
      id?: string;
      dispatchedAt?: Date;
    }
  ): HealthEscalationLogEntity {
    return new HealthEscalationLogEntity({
      ...params,
      id: params.id ?? crypto.randomUUID(),
      dispatchedAt: params.dispatchedAt ?? new Date(),
    });
  }

  public static reconstitute(
    props: HealthEscalationLogProps
  ): HealthEscalationLogEntity {
    return new HealthEscalationLogEntity({ ...props });
  }

  private validateInvariants(): void {
    if (!this.props.farmId || this.props.farmId.trim().length === 0) {
      throw new ValidationDomainException("farmId is required for escalation log");
    }
    if (!this.props.healthRecordId || this.props.healthRecordId.trim().length === 0) {
      throw new ValidationDomainException("healthRecordId is required for escalation log");
    }
    if (!this.props.animalId || this.props.animalId.trim().length === 0) {
      throw new ValidationDomainException("animalId is required for escalation log");
    }
    if (this.props.hoursUnresolved < 0) {
      throw new ValidationDomainException("hoursUnresolved cannot be negative");
    }
    if (!Object.values(HealthEscalationLevel).includes(this.props.level)) {
      throw new ValidationDomainException(`Invalid escalation level: ${this.props.level}`);
    }
    if (!Object.values(HealthEscalationAction).includes(this.props.actionTaken)) {
      throw new ValidationDomainException(`Invalid escalation action: ${this.props.actionTaken}`);
    }
    if (!Object.values(ReminderChannel).includes(this.props.channel)) {
      throw new ValidationDomainException(`Invalid reminder channel: ${this.props.channel}`);
    }
    if (!Object.values(ReminderStatus).includes(this.props.status)) {
      throw new ValidationDomainException(`Invalid reminder status: ${this.props.status}`);
    }
  }

  public get id(): string {
    return this.props.id;
  }

  public get farmId(): string {
    return this.props.farmId;
  }

  public get healthRecordId(): string {
    return this.props.healthRecordId;
  }

  public get animalId(): string {
    return this.props.animalId;
  }

  public get level(): HealthEscalationLevel {
    return this.props.level;
  }

  public get actionTaken(): HealthEscalationAction {
    return this.props.actionTaken;
  }

  public get recipientUserId(): string | null {
    return this.props.recipientUserId;
  }

  public get recipientPhone(): string | null {
    return this.props.recipientPhone;
  }

  public get channel(): ReminderChannel {
    return this.props.channel;
  }

  public get status(): ReminderStatus {
    return this.props.status;
  }

  public get notes(): string | null {
    return this.props.notes;
  }

  public get hoursUnresolved(): number {
    return this.props.hoursUnresolved;
  }

  public get dispatchedAt(): Date {
    return this.props.dispatchedAt;
  }

  public markFailed(notes?: string): void {
    this.props.status = ReminderStatus.FAILED;
    if (notes !== undefined) {
      this.props.notes = notes;
    }
  }

  public markSent(notes?: string): void {
    this.props.status = ReminderStatus.SENT;
    if (notes !== undefined) {
      this.props.notes = notes;
    }
  }

  public toResponseDto(): HealthEscalationLogResponseDto {
    return {
      id: this.props.id,
      farmId: this.props.farmId,
      healthRecordId: this.props.healthRecordId,
      animalId: this.props.animalId,
      level: this.props.level,
      actionTaken: this.props.actionTaken,
      recipientUserId: this.props.recipientUserId,
      recipientPhone: this.props.recipientPhone,
      channel: this.props.channel,
      status: this.props.status,
      notes: this.props.notes,
      hoursUnresolved: this.props.hoursUnresolved,
      dispatchedAt: this.props.dispatchedAt.toISOString(),
    };
  }
}
