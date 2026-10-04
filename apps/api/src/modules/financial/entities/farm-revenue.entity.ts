import {
  RevenueAnimalSummary,
  RevenueRecorderSummary,
  RevenueResponseDto,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export const VALID_REVENUE_CATEGORIES: ReadonlySet<TransactionCategory> =
  new Set([
    TransactionCategory.MILK_SALES,
    TransactionCategory.LIVESTOCK_SALES,
    TransactionCategory.MANURE,
    TransactionCategory.BYPRODUCTS,
    TransactionCategory.OTHER,
  ]);

export interface FarmRevenueEntityProps {
  id: string;
  farmId: string;
  recordedById: string;
  animalId: string | null;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  referenceNote: string | null;
  receiptUrl: string | null;
  metadata: Record<string, unknown>;
  txDate: Date;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  recordedBy?: RevenueRecorderSummary | null;
  animal?: RevenueAnimalSummary | null;
}

export interface CreateFarmRevenueProps {
  id?: string;
  farmId: string;
  recordedById: string;
  animalId?: string | null;
  category: TransactionCategory;
  amount: number;
  currency?: string;
  referenceNote?: string | null;
  receiptUrl?: string | null;
  metadata?: Record<string, unknown>;
  txDate: Date | string;
}

export interface UpdateFarmRevenueProps {
  category?: TransactionCategory;
  amount?: number;
  currency?: string;
  referenceNote?: string | null;
  animalId?: string | null;
  receiptUrl?: string | null;
  metadata?: Record<string, unknown>;
  txDate?: Date | string;
  syncVersion?: number;
}

export class FarmRevenueEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _recordedById: string;
  private _animalId: string | null;
  private readonly _type: TransactionType;
  private _category: TransactionCategory;
  private _amount: number;
  private _currency: string;
  private _referenceNote: string | null;
  private _receiptUrl: string | null;
  private _metadata: Record<string, unknown>;
  private _txDate: Date;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;
  private _recordedBy: RevenueRecorderSummary | null;
  private _animal: RevenueAnimalSummary | null;

  constructor(props: FarmRevenueEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._recordedById = props.recordedById;
    this._animalId = props.animalId ?? null;
    this._type = TransactionType.INCOME;
    this._category = props.category;
    this._amount = Math.round(Number(props.amount) * 100) / 100;
    this._currency = (props.currency || "USD").toUpperCase();
    this._referenceNote = props.referenceNote ?? null;
    this._receiptUrl = props.receiptUrl ?? null;
    this._metadata = props.metadata ?? {};
    this._txDate =
      typeof props.txDate === "string" ? new Date(props.txDate) : props.txDate;
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt ?? null;
    this._recordedBy = props.recordedBy ?? null;
    this._animal = props.animal ?? null;

    this.validateInvariants();
  }

  public static create(props: CreateFarmRevenueProps): FarmRevenueEntity {
    const now = new Date();
    const txDate =
      typeof props.txDate === "string" ? new Date(props.txDate) : props.txDate;

    return new FarmRevenueEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      recordedById: props.recordedById,
      animalId: props.animalId ?? null,
      type: TransactionType.INCOME,
      category: props.category,
      amount: props.amount,
      currency: (props.currency || "USD").toUpperCase(),
      referenceNote: props.referenceNote ?? null,
      receiptUrl: props.receiptUrl ?? null,
      metadata: props.metadata ?? {},
      txDate,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  public update(props: UpdateFarmRevenueProps): void {
    if (this._deletedAt !== null) {
      throw new ValidationDomainException(
        "Cannot update a revenue record that has been soft-deleted."
      );
    }

    if (
      props.syncVersion !== undefined &&
      props.syncVersion !== this._syncVersion
    ) {
      throw new ValidationDomainException(
        `Optimistic concurrency violation: Expected syncVersion ${this._syncVersion}, but received ${props.syncVersion}.`
      );
    }

    if (props.category !== undefined) {
      this._category = props.category;
    }

    if (props.amount !== undefined) {
      this._amount = Math.round(Number(props.amount) * 100) / 100;
    }

    if (props.currency !== undefined) {
      this._currency = props.currency.toUpperCase();
    }

    if (props.referenceNote !== undefined) {
      this._referenceNote = props.referenceNote;
    }

    if (props.animalId !== undefined) {
      this._animalId = props.animalId;
    }

    if (props.receiptUrl !== undefined) {
      this._receiptUrl = props.receiptUrl;
    }

    if (props.metadata !== undefined) {
      this._metadata = { ...this._metadata, ...props.metadata };
    }

    if (props.txDate !== undefined) {
      this._txDate =
        typeof props.txDate === "string"
          ? new Date(props.txDate)
          : props.txDate;
    }

    this.validateInvariants();

    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public softDelete(): void {
    if (this._deletedAt !== null) {
      throw new ValidationDomainException(
        "Revenue record has already been soft-deleted."
      );
    }
    this._deletedAt = new Date();
    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  private validateInvariants(): void {
    if (!this._farmId || !this._farmId.trim()) {
      throw new ValidationDomainException("Revenue must be bound to a valid farmId.");
    }

    if (!this._recordedById || !this._recordedById.trim()) {
      throw new ValidationDomainException(
        "Revenue must record the user ID of the actor."
      );
    }

    if (!VALID_REVENUE_CATEGORIES.has(this._category)) {
      throw new ValidationDomainException(
        `Category '${this._category}' is not a valid revenue category. Allowed categories: ${Array.from(
          VALID_REVENUE_CATEGORIES
        ).join(", ")}.`
      );
    }

    if (isNaN(this._amount) || this._amount <= 0) {
      throw new ValidationDomainException(
        "Revenue amount must be a positive number greater than 0."
      );
    }

    if (!/^[A-Z]{3}$/.test(this._currency)) {
      throw new ValidationDomainException(
        `Currency code '${this._currency}' must be a valid 3-letter ISO code.`
      );
    }

    if (!this._txDate || isNaN(this._txDate.getTime())) {
      throw new ValidationDomainException(
        "Transaction date must be a valid date."
      );
    }

    const maxAllowedDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (this._txDate.getTime() > maxAllowedDate.getTime()) {
      throw new ValidationDomainException(
        "Transaction date cannot be in the future."
      );
    }

    if (this._syncVersion < 1) {
      throw new ValidationDomainException(
        "syncVersion must be a positive integer greater than or equal to 1."
      );
    }
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get recordedById(): string {
    return this._recordedById;
  }

  public get animalId(): string | null {
    return this._animalId;
  }

  public get type(): TransactionType {
    return this._type;
  }

  public get category(): TransactionCategory {
    return this._category;
  }

  public get amount(): number {
    return this._amount;
  }

  public get currency(): string {
    return this._currency;
  }

  public get referenceNote(): string | null {
    return this._referenceNote;
  }

  public get receiptUrl(): string | null {
    return this._receiptUrl;
  }

  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  public get txDate(): Date {
    return this._txDate;
  }

  public get syncVersion(): number {
    return this._syncVersion;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get deletedAt(): Date | null {
    return this._deletedAt;
  }

  public get isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public get recordedBy(): RevenueRecorderSummary | null {
    return this._recordedBy;
  }

  public get animal(): RevenueAnimalSummary | null {
    return this._animal;
  }

  public toDto(): RevenueResponseDto {
    return {
      id: this._id,
      farmId: this._farmId,
      recordedById: this._recordedById,
      animalId: this._animalId,
      type: this._type,
      category: this._category,
      amount: this._amount,
      currency: this._currency,
      referenceNote: this._referenceNote,
      receiptUrl: this._receiptUrl,
      metadata: this.metadata,
      txDate: this._txDate.toISOString().split("T")[0]!,
      syncVersion: this._syncVersion,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      recordedBy: this._recordedBy ?? undefined,
      animal: this._animal ?? null,
    };
  }
}
