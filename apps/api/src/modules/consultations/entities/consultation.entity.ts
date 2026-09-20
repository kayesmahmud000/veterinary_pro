import {
  ConsultationPaymentStatus,
  ConsultationResponseDto,
  ConsultationStatus,
  ConsultationType,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ConsultationEntityProps {
  id: string;
  farmerId: string;
  vetId: string | null;
  farmId: string;
  animalId: string | null;
  chiefComplaint: string;
  mediaUrls: string[];
  type: ConsultationType;
  status: ConsultationStatus;
  roomSessionId: string | null;
  feeCents: number;
  scheduledAt?: Date | null;
  assignedAt?: Date | null;
  paymentStatus?: ConsultationPaymentStatus;
  paymentIntentId?: string | null;
  paymentHeldAt?: Date | null;
  paymentCapturedAt?: Date | null;
  paymentReleasedAt?: Date | null;
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
  farmer?: { id: string; name: string; email: string } | null;
  vet?: { id: string; name: string; email: string } | null;
  animal?: { id: string; name: string; tagNumber: string; species: string } | null;
  farm?: { id: string; name: string } | null;
}

export interface CreateConsultationProps {
  id?: string;
  farmerId: string;
  farmId: string;
  animalId?: string | null;
  chiefComplaint: string;
  mediaUrls?: string[];
  type?: ConsultationType;
  feeCents?: number;
  currency?: string;
  scheduledAt?: Date | null;
  now?: Date;
}

export class ConsultationEntity {
  private readonly _id: string;
  private readonly _farmerId: string;
  private _vetId: string | null;
  private readonly _farmId: string;
  private readonly _animalId: string | null;
  private _chiefComplaint: string;
  private _mediaUrls: string[];
  private _type: ConsultationType;
  private _status: ConsultationStatus;
  private _roomSessionId: string | null;
  private _feeCents: number;
  private _scheduledAt: Date | null;
  private _assignedAt: Date | null;
  private _paymentStatus: ConsultationPaymentStatus;
  private _paymentIntentId: string | null;
  private _paymentHeldAt: Date | null;
  private _paymentCapturedAt: Date | null;
  private _paymentReleasedAt: Date | null;
  private _currency: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _farmer: { id: string; name: string; email: string } | null;
  private readonly _vet: { id: string; name: string; email: string } | null;
  private readonly _animal: {
    id: string;
    name: string;
    tagNumber: string;
    species: string;
  } | null;
  private readonly _farm: { id: string; name: string } | null;

  private constructor(props: ConsultationEntityProps) {
    this._id = props.id;
    this._farmerId = props.farmerId;
    this._vetId = props.vetId;
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._chiefComplaint = props.chiefComplaint;
    this._mediaUrls = props.mediaUrls;
    this._type = props.type;
    this._status = props.status;
    this._roomSessionId = props.roomSessionId;
    this._feeCents = props.feeCents;
    this._scheduledAt = props.scheduledAt ?? null;
    this._assignedAt = props.assignedAt ?? null;
    this._paymentStatus = props.paymentStatus ?? ConsultationPaymentStatus.UNPAID;
    this._paymentIntentId = props.paymentIntentId ?? null;
    this._paymentHeldAt = props.paymentHeldAt ?? null;
    this._paymentCapturedAt = props.paymentCapturedAt ?? null;
    this._paymentReleasedAt = props.paymentReleasedAt ?? null;
    this._currency = props.currency ?? "USD";
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._farmer = props.farmer ?? null;
    this._vet = props.vet ?? null;
    this._animal = props.animal ?? null;
    this._farm = props.farm ?? null;
  }

  public static create(props: CreateConsultationProps): ConsultationEntity {
    if (!props.farmerId) {
      throw new ValidationDomainException("Farmer ID is required to create a consultation request");
    }
    if (!props.farmId) {
      throw new ValidationDomainException("Farm ID is required to create a consultation request");
    }
    if (!props.chiefComplaint || props.chiefComplaint.trim().length < 10) {
      throw new ValidationDomainException("Chief complaint must be at least 10 characters long");
    }

    const now = props.now ?? new Date();
    const fee = props.feeCents ?? 0;
    // If fee is 0 (routine check or tier-covered), payment is automatically considered captured
    const initialPaymentStatus =
      fee === 0
        ? ConsultationPaymentStatus.CAPTURED
        : ConsultationPaymentStatus.UNPAID;

    return new ConsultationEntity({
      id: props.id ?? crypto.randomUUID(),
      farmerId: props.farmerId,
      vetId: null,
      farmId: props.farmId,
      animalId: props.animalId ?? null,
      chiefComplaint: props.chiefComplaint.trim(),
      mediaUrls: props.mediaUrls ?? [],
      type: props.type ?? ConsultationType.ASYNC_TICKET,
      status: ConsultationStatus.SUBMITTED,
      roomSessionId: null,
      feeCents: fee,
      scheduledAt: props.scheduledAt ?? null,
      assignedAt: null,
      paymentStatus: initialPaymentStatus,
      paymentIntentId: null,
      paymentHeldAt: null,
      paymentCapturedAt: fee === 0 ? now : null,
      paymentReleasedAt: null,
      currency: props.currency ?? "USD",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromPersistence(record: any): ConsultationEntity {
    return new ConsultationEntity({
      id: record.id,
      farmerId: record.farmerId,
      vetId: record.vetId ?? null,
      farmId: record.farmId,
      animalId: record.animalId ?? null,
      chiefComplaint: record.chiefComplaint,
      mediaUrls: Array.isArray(record.mediaUrls) ? record.mediaUrls : [],
      type: record.type as ConsultationType,
      status: record.status as ConsultationStatus,
      roomSessionId: record.roomSessionId ?? null,
      feeCents: record.feeCents,
      scheduledAt: record.scheduledAt ? new Date(record.scheduledAt) : null,
      assignedAt: record.assignedAt ? new Date(record.assignedAt) : null,
      paymentStatus:
        (record.paymentStatus as ConsultationPaymentStatus) ??
        ConsultationPaymentStatus.UNPAID,
      paymentIntentId: record.paymentIntentId ?? null,
      paymentHeldAt: record.paymentHeldAt ? new Date(record.paymentHeldAt) : null,
      paymentCapturedAt: record.paymentCapturedAt
        ? new Date(record.paymentCapturedAt)
        : null,
      paymentReleasedAt: record.paymentReleasedAt
        ? new Date(record.paymentReleasedAt)
        : null,
      currency: record.currency ?? "USD",
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      farmer: record.farmer
        ? {
            id: record.farmer.id,
            name: record.farmer.name,
            email: record.farmer.email,
          }
        : null,
      vet: record.vet
        ? {
            id: record.vet.id,
            name: record.vet.name,
            email: record.vet.email,
          }
        : null,
      animal: record.animal
        ? {
            id: record.animal.id,
            name: record.animal.name,
            tagNumber: record.animal.tagNumber,
            species: record.animal.species,
          }
        : null,
      farm: record.farm
        ? {
            id: record.farm.id,
            name: record.farm.name,
          }
        : null,
    });
  }

  // Payment Invariants & State Transitions
  public placePaymentHold(paymentIntentId: string, now = new Date()): void {
    if (this._paymentStatus === ConsultationPaymentStatus.CAPTURED) {
      throw new ValidationDomainException(
        "Cannot place payment hold on consultation in status 'CAPTURED'",
      );
    }

    if (this._feeCents <= 0) {
      this._paymentStatus = ConsultationPaymentStatus.CAPTURED;
      this._paymentCapturedAt = now;
      this._updatedAt = now;
      return;
    }

    if (!paymentIntentId || paymentIntentId.trim().length === 0) {
      throw new ValidationDomainException("PaymentIntent ID is required to place an authorization hold.");
    }

    this._paymentStatus = ConsultationPaymentStatus.AUTHORIZED;
    this._paymentIntentId = paymentIntentId;
    this._paymentHeldAt = now;
    this._updatedAt = now;
  }

  public capturePayment(now = new Date()): void {
    if (this._feeCents <= 0) {
      this._paymentStatus = ConsultationPaymentStatus.CAPTURED;
      this._paymentCapturedAt = now;
      this._updatedAt = now;
      return;
    }

    if (this._paymentStatus !== ConsultationPaymentStatus.AUTHORIZED) {
      throw new ValidationDomainException(
        `Cannot capture payment for consultation in payment status '${this._paymentStatus}'. Payment must be AUTHORIZED.`,
      );
    }

    this._paymentStatus = ConsultationPaymentStatus.CAPTURED;
    this._paymentCapturedAt = now;
    this._updatedAt = now;
  }

  public releasePaymentHold(now = new Date()): void {
    if (this._paymentStatus === ConsultationPaymentStatus.CAPTURED) {
      throw new ValidationDomainException(
        "Cannot release payment in status 'CAPTURED'",
      );
    }

    if (this._paymentStatus !== ConsultationPaymentStatus.AUTHORIZED) {
      // If not currently authorized (e.g. UNPAID or 0 fee), release is a no-op
      return;
    }

    this._paymentStatus = ConsultationPaymentStatus.RELEASED;
    this._paymentReleasedAt = now;
    this._updatedAt = now;
  }

  public markPaymentFailed(now = new Date()): void {
    this._paymentStatus = ConsultationPaymentStatus.FAILED;
    this._updatedAt = now;
  }

  public isPaymentAuthorized(): boolean {
    return (
      this._paymentStatus === ConsultationPaymentStatus.AUTHORIZED ||
      this._paymentStatus === ConsultationPaymentStatus.CAPTURED ||
      this._feeCents === 0
    );
  }

  // Clinical Domain Invariants & Transitions
  public assignToVet(
    vetId: string,
    scheduledAt?: Date | null,
    now = new Date(),
  ): void {
    if (!this.canBeAssigned()) {
      throw new ValidationDomainException(
        `Cannot assign consultation in status '${this._status}'. Allowed statuses: [SUBMITTED, ASSIGNED].`,
      );
    }
    if (!vetId) {
      throw new ValidationDomainException("Veterinarian ID is required for assignment.");
    }
    this._vetId = vetId;
    this._status = ConsultationStatus.ASSIGNED;
    this._assignedAt = now;
    if (scheduledAt !== undefined) {
      this._scheduledAt = scheduledAt;
    }
    this._updatedAt = now;
  }

  public startConsultation(roomSessionId?: string, now = new Date()): void {
    if (this._status !== ConsultationStatus.ASSIGNED && this._status !== ConsultationStatus.SUBMITTED) {
      throw new ValidationDomainException(
        `Cannot start consultation in status '${this._status}'. Consultation must be ASSIGNED or SUBMITTED.`,
      );
    }
    this._status = ConsultationStatus.IN_PROGRESS;
    if (roomSessionId) {
      this._roomSessionId = roomSessionId;
    }
    this._updatedAt = now;
  }

  public setRoomSessionId(roomSessionId: string, now = new Date()): void {
    if (!roomSessionId || roomSessionId.trim().length === 0) {
      throw new ValidationDomainException("Room session ID cannot be empty.");
    }
    this._roomSessionId = roomSessionId.trim();
    this._updatedAt = now;
  }

  public complete(now = new Date()): void {
    if (this._status !== ConsultationStatus.IN_PROGRESS && this._status !== ConsultationStatus.ASSIGNED) {
      throw new ValidationDomainException(
        `Cannot complete consultation in status '${this._status}'. Consultation must be IN_PROGRESS or ASSIGNED.`,
      );
    }
    this._status = ConsultationStatus.COMPLETED;
    this._updatedAt = now;

    // Automatically capture payment if it was authorized
    if (this._paymentStatus === ConsultationPaymentStatus.AUTHORIZED) {
      this._paymentStatus = ConsultationPaymentStatus.CAPTURED;
      this._paymentCapturedAt = now;
    }
  }

  public cancel(now = new Date()): void {
    if (!this.canBeCancelled()) {
      throw new ValidationDomainException(
        `Cannot cancel consultation in status '${this._status}'. Completed consultations cannot be cancelled.`,
      );
    }
    this._status = ConsultationStatus.CANCELLED;
    this._updatedAt = now;

    // Automatically release payment hold if authorized
    if (this._paymentStatus === ConsultationPaymentStatus.AUTHORIZED) {
      this._paymentStatus = ConsultationPaymentStatus.RELEASED;
      this._paymentReleasedAt = now;
    }
  }

  // Status checks
  public isSubmitted(): boolean {
    return this._status === ConsultationStatus.SUBMITTED;
  }

  public isAssigned(): boolean {
    return this._status === ConsultationStatus.ASSIGNED;
  }

  public isInProgress(): boolean {
    return this._status === ConsultationStatus.IN_PROGRESS;
  }

  public isCompleted(): boolean {
    return this._status === ConsultationStatus.COMPLETED;
  }

  public isCancelled(): boolean {
    return this._status === ConsultationStatus.CANCELLED;
  }

  public canBeAssigned(): boolean {
    return (
      this._status === ConsultationStatus.SUBMITTED ||
      this._status === ConsultationStatus.ASSIGNED
    );
  }

  public canBeCancelled(): boolean {
    return this._status !== ConsultationStatus.COMPLETED && this._status !== ConsultationStatus.CANCELLED;
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get farmerId(): string {
    return this._farmerId;
  }

  public get vetId(): string | null {
    return this._vetId;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get animalId(): string | null {
    return this._animalId;
  }

  public get chiefComplaint(): string {
    return this._chiefComplaint;
  }

  public get mediaUrls(): string[] {
    return [...this._mediaUrls];
  }

  public get type(): ConsultationType {
    return this._type;
  }

  public get status(): ConsultationStatus {
    return this._status;
  }

  public get roomSessionId(): string | null {
    return this._roomSessionId;
  }

  public get feeCents(): number {
    return this._feeCents;
  }

  public get scheduledAt(): Date | null {
    return this._scheduledAt;
  }

  public get assignedAt(): Date | null {
    return this._assignedAt;
  }

  public get paymentStatus(): ConsultationPaymentStatus {
    return this._paymentStatus;
  }

  public get paymentIntentId(): string | null {
    return this._paymentIntentId;
  }

  public get paymentHeldAt(): Date | null {
    return this._paymentHeldAt;
  }

  public get paymentCapturedAt(): Date | null {
    return this._paymentCapturedAt;
  }

  public get paymentReleasedAt(): Date | null {
    return this._paymentReleasedAt;
  }

  public get currency(): string {
    return this._currency;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get farmer(): { id: string; name: string; email: string } | null {
    return this._farmer;
  }

  public get vet(): { id: string; name: string; email: string } | null {
    return this._vet;
  }

  public get animal(): {
    id: string;
    name: string;
    tagNumber: string;
    species: string;
  } | null {
    return this._animal;
  }

  public get farm(): { id: string; name: string } | null {
    return this._farm;
  }

  public toResponseDto(): ConsultationResponseDto {
    return {
      id: this._id,
      farmerId: this._farmerId,
      vetId: this._vetId,
      farmId: this._farmId,
      animalId: this._animalId,
      chiefComplaint: this._chiefComplaint,
      mediaUrls: [...this._mediaUrls],
      type: this._type,
      status: this._status,
      roomSessionId: this._roomSessionId,
      feeCents: this._feeCents,
      scheduledAt: this._scheduledAt ? this._scheduledAt.toISOString() : null,
      assignedAt: this._assignedAt ? this._assignedAt.toISOString() : null,
      paymentStatus: this._paymentStatus,
      paymentIntentId: this._paymentIntentId,
      paymentHeldAt: this._paymentHeldAt ? this._paymentHeldAt.toISOString() : null,
      paymentCapturedAt: this._paymentCapturedAt
        ? this._paymentCapturedAt.toISOString()
        : null,
      paymentReleasedAt: this._paymentReleasedAt
        ? this._paymentReleasedAt.toISOString()
        : null,
      currency: this._currency,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      farmer: this._farmer,
      vet: this._vet,
      animal: this._animal,
      farm: this._farm,
    };
  }
}
