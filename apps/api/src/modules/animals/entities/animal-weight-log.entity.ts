import { AnimalWeightLogDto } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface CreateAnimalWeightLogProps {
  id?: string;
  farmId: string;
  animalId: string;
  recordedById: string;
  weightKg: number;
  recordedAt: Date;
  notes?: string | null;
  recordedByName?: string | null;
  syncVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AnimalWeightLogEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _animalId: string;
  private readonly _recordedById: string;
  private _weightKg: number;
  private _recordedAt: Date;
  private _notes: string | null;
  private _recordedByName: string | null;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateAnimalWeightLogProps) {
    this._id = props.id ?? crypto.randomUUID();
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._recordedById = props.recordedById;
    this._weightKg = props.weightKg;
    this._recordedAt = props.recordedAt;
    this._notes = props.notes?.trim() || null;
    this._recordedByName = props.recordedByName ?? null;
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();

    this.validate();
  }

  public static create(props: CreateAnimalWeightLogProps): AnimalWeightLogEntity {
    return new AnimalWeightLogEntity(props);
  }

  public static reconstitute(props: CreateAnimalWeightLogProps): AnimalWeightLogEntity {
    return new AnimalWeightLogEntity(props);
  }

  private validate(): void {
    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("Farm ID is required for weight record.");
    }
    if (!this._animalId || this._animalId.trim().length === 0) {
      throw new ValidationDomainException("Animal ID is required for weight record.");
    }
    if (!this._recordedById || this._recordedById.trim().length === 0) {
      throw new ValidationDomainException("Recorder User ID is required for weight record.");
    }
    if (
      typeof this._weightKg !== "number" ||
      isNaN(this._weightKg) ||
      this._weightKg <= 0
    ) {
      throw new ValidationDomainException("Weight must be a positive number greater than 0 kg.");
    }
    if (this._weightKg > 2500) {
      throw new ValidationDomainException("Weight cannot exceed 2,500 kg.");
    }
    if (isNaN(this._recordedAt.getTime())) {
      throw new ValidationDomainException("Invalid recordedAt timestamp.");
    }
    // Allow up to 60 seconds of clock skew for future timestamp check
    if (this._recordedAt.getTime() > Date.now() + 60000) {
      throw new ValidationDomainException("Weight measurement cannot be recorded in the future.");
    }
    if (this._notes && this._notes.length > 1000) {
      throw new ValidationDomainException("Notes cannot exceed 1,000 characters.");
    }
  }

  public get id(): string {
    return this._id;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get animalId(): string {
    return this._animalId;
  }

  public get recordedById(): string {
    return this._recordedById;
  }

  public get weightKg(): number {
    return this._weightKg;
  }

  public get recordedAt(): Date {
    return this._recordedAt;
  }

  public get notes(): string | null {
    return this._notes;
  }

  public get recordedByName(): string | null {
    return this._recordedByName;
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

  public calculateAgeDays(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const diffMs = this._recordedAt.getTime() - birthDate.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  public toResponse(birthDate?: Date | null): AnimalWeightLogDto {
    return {
      id: this._id,
      animalId: this._animalId,
      farmId: this._farmId,
      weightKg: Math.round(this._weightKg * 100) / 100,
      recordedAt: this._recordedAt.toISOString(),
      notes: this._notes,
      recordedById: this._recordedById,
      recordedByName: this._recordedByName,
      ageDays: birthDate ? this.calculateAgeDays(birthDate) : null,
      syncVersion: this._syncVersion,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
