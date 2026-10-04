import {
  MilkLogAnimalSummaryDto,
  MilkLogRecorderSummaryDto,
  MilkLogResponseDto,
  MilkSession,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface MilkLogEntityProps {
  id: string;
  farmId: string;
  animalId: string | null;
  recordedById: string;
  session: MilkSession;
  yieldLiters: number;
  fatPercent: number | null;
  snfPercent: number | null;
  loggedDate: Date;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
  animal?: MilkLogAnimalSummaryDto | null;
  recordedBy?: MilkLogRecorderSummaryDto | null;
}

export interface CreateMilkLogProps {
  id?: string;
  farmId: string;
  animalId: string | null;
  recordedById: string;
  session: MilkSession;
  yieldLiters: number;
  fatPercent?: number | null;
  snfPercent?: number | null;
  loggedDate: Date;
}

export class MilkLogEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _animalId: string | null;
  private readonly _recordedById: string;
  private _session: MilkSession;
  private _yieldLiters: number;
  private _fatPercent: number | null;
  private _snfPercent: number | null;
  private _loggedDate: Date;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _animal: MilkLogAnimalSummaryDto | null;
  private _recordedBy: MilkLogRecorderSummaryDto | null;

  constructor(props: MilkLogEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._recordedById = props.recordedById;
    this._session = props.session;
    this._yieldLiters = props.yieldLiters;
    this._fatPercent = props.fatPercent ?? null;
    this._snfPercent = props.snfPercent ?? null;
    this._loggedDate = props.loggedDate;
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._animal = props.animal ?? null;
    this._recordedBy = props.recordedBy ?? null;

    this.validateInvariants();
  }

  public static create(props: CreateMilkLogProps): MilkLogEntity {
    const now = new Date();
    return new MilkLogEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      animalId: props.animalId,
      recordedById: props.recordedById,
      session: props.session,
      yieldLiters: props.yieldLiters,
      fatPercent: props.fatPercent ?? null,
      snfPercent: props.snfPercent ?? null,
      loggedDate: props.loggedDate,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  private validateInvariants(): void {
    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("MilkLog must belong to a farm tenant (farmId is required).");
    }
    if (!this._recordedById || this._recordedById.trim().length === 0) {
      throw new ValidationDomainException("MilkLog must have a recording user (recordedById is required).");
    }
    if (this._yieldLiters <= 0) {
      throw new ValidationDomainException("Milk yield must be greater than 0 liters.");
    }
    const maxYield = this._animalId === null ? 100000 : 100;
    if (this._yieldLiters > maxYield) {
      throw new ValidationDomainException(
        `Milk yield of ${this._yieldLiters}L exceeds maximum single session threshold (${maxYield}L).`
      );
    }
    if (this._fatPercent !== null && (this._fatPercent < 0 || this._fatPercent > 20)) {
      throw new ValidationDomainException("Fat percentage must be between 0.00% and 20.00%.");
    }
    if (this._snfPercent !== null && (this._snfPercent < 0 || this._snfPercent > 20)) {
      throw new ValidationDomainException("Solids-not-fat (SNF) percentage must be between 0.00% and 20.00%.");
    }
  }

  public get id(): string {
    return this._id;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get animalId(): string | null {
    return this._animalId;
  }

  public get recordedById(): string {
    return this._recordedById;
  }

  public get session(): MilkSession {
    return this._session;
  }

  public get yieldLiters(): number {
    return this._yieldLiters;
  }

  public get fatPercent(): number | null {
    return this._fatPercent;
  }

  public get snfPercent(): number | null {
    return this._snfPercent;
  }

  public get loggedDate(): Date {
    return this._loggedDate;
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

  public get isBulk(): boolean {
    return this._animalId === null;
  }

  public get animal(): MilkLogAnimalSummaryDto | null {
    return this._animal;
  }

  public get recordedBy(): MilkLogRecorderSummaryDto | null {
    return this._recordedBy;
  }

  public setAnimalSummary(animal: MilkLogAnimalSummaryDto | null): void {
    this._animal = animal;
  }

  public setRecorderSummary(recorder: MilkLogRecorderSummaryDto | null): void {
    this._recordedBy = recorder;
  }

  public update(props: {
    yieldLiters?: number;
    fatPercent?: number | null;
    snfPercent?: number | null;
    session?: MilkSession;
    loggedDate?: Date;
  }): void {
    if (props.yieldLiters !== undefined) {
      const maxYield = this._animalId === null ? 100000 : 100;
      if (props.yieldLiters <= 0 || props.yieldLiters > maxYield) {
        throw new ValidationDomainException(`Yield must be between 0.001 and ${maxYield}.000 liters.`);
      }
      this._yieldLiters = props.yieldLiters;
    }
    if (props.fatPercent !== undefined) {
      if (props.fatPercent !== null && (props.fatPercent < 0 || props.fatPercent > 20)) {
        throw new ValidationDomainException("Fat percentage must be between 0.00% and 20.00%.");
      }
      this._fatPercent = props.fatPercent;
    }
    if (props.snfPercent !== undefined) {
      if (props.snfPercent !== null && (props.snfPercent < 0 || props.snfPercent > 20)) {
        throw new ValidationDomainException("SNF percentage must be between 0.00% and 20.00%.");
      }
      this._snfPercent = props.snfPercent;
    }
    if (props.session !== undefined) {
      this._session = props.session;
    }
    if (props.loggedDate !== undefined) {
      this._loggedDate = props.loggedDate;
    }

    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public toResponseDto(): MilkLogResponseDto {
    const formattedDate = this._loggedDate instanceof Date
      ? this._loggedDate.toISOString().split("T")[0]!
      : String(this._loggedDate);

    return {
      id: this._id,
      farmId: this._farmId,
      animalId: this._animalId,
      recordedById: this._recordedById,
      session: this._session,
      yieldLiters: Number(this._yieldLiters),
      fatPercent: this._fatPercent !== null ? Number(this._fatPercent) : null,
      snfPercent: this._snfPercent !== null ? Number(this._snfPercent) : null,
      loggedDate: formattedDate,
      syncVersion: this._syncVersion,
      animal: this._animal,
      recordedBy: this._recordedBy,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
