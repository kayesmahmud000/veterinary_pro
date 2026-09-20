import {
  ConsultationPayoutLedgerDto,
  PayoutStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface PayoutLedgerProps {
  id: string;
  consultationId: string;
  vetId: string;
  totalFeeCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  vetPayoutCents: number;
  currency: string;
  status: PayoutStatus;
  payoutBatchId?: string | null;
  payoutReference?: string | null;
  processedAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  vet?: {
    id: string;
    name: string;
    email: string;
  } | null;
  consultation?: {
    id: string;
    chiefComplaint: string;
    type: string;
    feeCents: number;
    farmId: string;
    farmerId: string;
  } | null;
}

export interface CreatePayoutLedgerProps {
  id?: string;
  consultationId: string;
  vetId: string;
  totalFeeCents: number;
  platformFeeRate?: number; // default 0.20
  currency?: string; // default "USD"
  metadata?: Record<string, unknown>;
}

export class PayoutLedgerEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _vetId: string;
  private readonly _totalFeeCents: number;
  private readonly _platformFeeRate: number;
  private readonly _platformFeeCents: number;
  private readonly _vetPayoutCents: number;
  private readonly _currency: string;
  private _status: PayoutStatus;
  private _payoutBatchId: string | null;
  private _payoutReference: string | null;
  private _processedAt: Date | null;
  private _metadata: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _vet?: {
    id: string;
    name: string;
    email: string;
  } | null;
  private _consultation?: {
    id: string;
    chiefComplaint: string;
    type: string;
    feeCents: number;
    farmId: string;
    farmerId: string;
  } | null;

  private constructor(props: PayoutLedgerProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._vetId = props.vetId;
    this._totalFeeCents = props.totalFeeCents;
    this._platformFeeRate = props.platformFeeRate;
    this._platformFeeCents = props.platformFeeCents;
    this._vetPayoutCents = props.vetPayoutCents;
    this._currency = props.currency;
    this._status = props.status;
    this._payoutBatchId = props.payoutBatchId ?? null;
    this._payoutReference = props.payoutReference ?? null;
    this._processedAt = props.processedAt ?? null;
    this._metadata = props.metadata ?? {};
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._vet = props.vet ?? null;
    this._consultation = props.consultation ?? null;
  }

  public static create(props: CreatePayoutLedgerProps): PayoutLedgerEntity {
    if (!props.consultationId || props.consultationId.trim() === "") {
      throw new ValidationDomainException(
        "Consultation ID is required to create a payout ledger record.",
      );
    }
    if (!props.vetId || props.vetId.trim() === "") {
      throw new ValidationDomainException(
        "Veterinarian ID is required to create a payout ledger record.",
      );
    }
    if (props.totalFeeCents < 0) {
      throw new ValidationDomainException(
        "Total fee cents cannot be negative.",
      );
    }

    const platformFeeRate = props.platformFeeRate ?? 0.2;
    if (platformFeeRate < 0 || platformFeeRate > 1) {
      throw new ValidationDomainException(
        "Platform fee rate must be between 0 and 1 (inclusive).",
      );
    }

    const platformFeeCents = Math.round(props.totalFeeCents * platformFeeRate);
    const vetPayoutCents = props.totalFeeCents - platformFeeCents;

    const now = new Date();
    return new PayoutLedgerEntity({
      id: props.id ?? crypto.randomUUID(),
      consultationId: props.consultationId,
      vetId: props.vetId,
      totalFeeCents: props.totalFeeCents,
      platformFeeRate,
      platformFeeCents,
      vetPayoutCents,
      currency: props.currency ?? "USD",
      status: PayoutStatus.PENDING,
      payoutBatchId: null,
      payoutReference: null,
      processedAt: null,
      metadata: props.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromPersistence(props: PayoutLedgerProps): PayoutLedgerEntity {
    return new PayoutLedgerEntity(props);
  }

  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get vetId(): string {
    return this._vetId;
  }

  public get totalFeeCents(): number {
    return this._totalFeeCents;
  }

  public get platformFeeRate(): number {
    return this._platformFeeRate;
  }

  public get platformFeeCents(): number {
    return this._platformFeeCents;
  }

  public get vetPayoutCents(): number {
    return this._vetPayoutCents;
  }

  public get currency(): string {
    return this._currency;
  }

  public get status(): PayoutStatus {
    return this._status;
  }

  public get payoutBatchId(): string | null {
    return this._payoutBatchId;
  }

  public get payoutReference(): string | null {
    return this._payoutReference;
  }

  public get processedAt(): Date | null {
    return this._processedAt;
  }

  public get metadata(): Record<string, unknown> {
    return this._metadata;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get vet(): { id: string; name: string; email: string } | null | undefined {
    return this._vet;
  }

  public get consultation(): {
    id: string;
    chiefComplaint: string;
    type: string;
    feeCents: number;
    farmId: string;
    farmerId: string;
  } | null | undefined {
    return this._consultation;
  }

  public markProcessing(batchId?: string): void {
    if (this._status === PayoutStatus.PAID) {
      throw new ValidationDomainException(
        "Cannot move already PAID payout to PROCESSING.",
      );
    }
    if (this._status === PayoutStatus.REVERSED) {
      throw new ValidationDomainException(
        "Cannot process a REVERSED payout.",
      );
    }
    this._status = PayoutStatus.PROCESSING;
    if (batchId) {
      this._payoutBatchId = batchId;
    }
    this._updatedAt = new Date();
  }

  public markPaid(reference?: string, batchId?: string, at?: Date): void {
    if (this._status === PayoutStatus.PAID) {
      return; // Idempotent
    }
    if (this._status === PayoutStatus.REVERSED) {
      throw new ValidationDomainException(
        "Cannot mark a REVERSED payout as PAID.",
      );
    }
    this._status = PayoutStatus.PAID;
    if (reference) {
      this._payoutReference = reference;
    }
    if (batchId) {
      this._payoutBatchId = batchId;
    }
    this._processedAt = at ?? new Date();
    this._updatedAt = new Date();
  }

  public hold(reason?: string): void {
    if (this._status === PayoutStatus.PAID) {
      throw new ValidationDomainException(
        "Cannot hold a payout that has already been PAID.",
      );
    }
    this._status = PayoutStatus.HELD;
    if (reason) {
      this._metadata = { ...this._metadata, holdReason: reason };
    }
    this._updatedAt = new Date();
  }

  public reverse(reason?: string): void {
    this._status = PayoutStatus.REVERSED;
    if (reason) {
      this._metadata = { ...this._metadata, reverseReason: reason };
    }
    this._updatedAt = new Date();
  }

  public toDto(): ConsultationPayoutLedgerDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      vetId: this._vetId,
      totalFeeCents: this._totalFeeCents,
      platformFeeRate: Number(this._platformFeeRate),
      platformFeeCents: this._platformFeeCents,
      vetPayoutCents: this._vetPayoutCents,
      currency: this._currency,
      status: this._status,
      payoutBatchId: this._payoutBatchId,
      payoutReference: this._payoutReference,
      processedAt: this._processedAt ? this._processedAt.toISOString() : null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      vet: this._vet,
      consultation: this._consultation,
    };
  }
}
