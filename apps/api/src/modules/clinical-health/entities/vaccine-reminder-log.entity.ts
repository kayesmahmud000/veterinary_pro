import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
  VaccineReminderLogResponseDto,
} from "@vetralink/shared-types";

export interface VaccineReminderLogProps {
  id: string;
  farmId: string;
  vaccineRecordId: string;
  animalId: string;
  recipientUserId: string | null;
  recipientPhone: string | null;
  channel: ReminderChannel;
  milestone: ReminderMilestone;
  status: ReminderStatus;
  message: string;
  errorMessage: string | null;
  dispatchedDate: string;
  dispatchedAt: Date;
}

export class VaccineReminderLogEntity {
  private constructor(private readonly props: VaccineReminderLogProps) {}

  public static create(
    params: Omit<VaccineReminderLogProps, "id" | "dispatchedAt"> & {
      id?: string;
      dispatchedAt?: Date;
    }
  ): VaccineReminderLogEntity {
    return new VaccineReminderLogEntity({
      ...params,
      id: params.id ?? crypto.randomUUID(),
      dispatchedAt: params.dispatchedAt ?? new Date(),
    });
  }

  public static reconstitute(
    props: VaccineReminderLogProps
  ): VaccineReminderLogEntity {
    return new VaccineReminderLogEntity({ ...props });
  }

  public get id(): string {
    return this.props.id;
  }

  public get farmId(): string {
    return this.props.farmId;
  }

  public get vaccineRecordId(): string {
    return this.props.vaccineRecordId;
  }

  public get animalId(): string {
    return this.props.animalId;
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

  public get milestone(): ReminderMilestone {
    return this.props.milestone;
  }

  public get status(): ReminderStatus {
    return this.props.status;
  }

  public get message(): string {
    return this.props.message;
  }

  public get errorMessage(): string | null {
    return this.props.errorMessage;
  }

  public get dispatchedDate(): string {
    return this.props.dispatchedDate;
  }

  public get dispatchedAt(): Date {
    return this.props.dispatchedAt;
  }

  public markFailed(errorMessage: string): void {
    this.props.status = ReminderStatus.FAILED;
    this.props.errorMessage = errorMessage;
  }

  public markSent(): void {
    this.props.status = ReminderStatus.SENT;
    this.props.errorMessage = null;
  }

  public toResponseDto(): VaccineReminderLogResponseDto {
    return {
      id: this.props.id,
      farmId: this.props.farmId,
      vaccineRecordId: this.props.vaccineRecordId,
      animalId: this.props.animalId,
      recipientUserId: this.props.recipientUserId,
      recipientPhone: this.props.recipientPhone,
      channel: this.props.channel,
      milestone: this.props.milestone,
      status: this.props.status,
      message: this.props.message,
      errorMessage: this.props.errorMessage,
      dispatchedDate: this.props.dispatchedDate,
      dispatchedAt: this.props.dispatchedAt.toISOString(),
    };
  }
}
