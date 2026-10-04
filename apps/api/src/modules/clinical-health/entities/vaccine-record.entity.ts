import {
  PreventativeScheduleStatus,
  VaccineRecordResponseDto,
  VaccineRecordType,
  HealthIncidentAnimalSummaryDto,
  HealthIncidentUserSummaryDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface VaccineRecordEntityProps {
  id: string;
  farmId: string;
  animalId: string;
  administeredById: string;
  recordType: VaccineRecordType;
  vaccineName: string;
  batchNumber: string | null;
  doseAmount: number;
  doseUnit: string;
  cost: number;
  notes: string | null;
  administeredAt: Date;
  nextDueDate: Date | null;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
  animal?: HealthIncidentAnimalSummaryDto | null;
  administeredBy?: HealthIncidentUserSummaryDto | null;
}

export interface CreateVaccineRecordProps {
  id?: string;
  farmId: string;
  animalId: string;
  administeredById: string;
  recordType?: VaccineRecordType;
  vaccineName: string;
  batchNumber?: string | null;
  doseAmount: number;
  doseUnit?: string;
  cost?: number;
  notes?: string | null;
  administeredAt: Date;
  nextDueDate?: Date | null;
}

export class VaccineRecordEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _animalId: string;
  private readonly _administeredById: string;
  private _recordType: VaccineRecordType;
  private _vaccineName: string;
  private _batchNumber: string | null;
  private _doseAmount: number;
  private _doseUnit: string;
  private _cost: number;
  private _notes: string | null;
  private _administeredAt: Date;
  private _nextDueDate: Date | null;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _animal: HealthIncidentAnimalSummaryDto | null;
  private _administeredBy: HealthIncidentUserSummaryDto | null;

  constructor(props: VaccineRecordEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._administeredById = props.administeredById;
    this._recordType = props.recordType ?? VaccineRecordType.VACCINATION;
    this._vaccineName = props.vaccineName;
    this._batchNumber = props.batchNumber ?? null;
    this._doseAmount = Number(props.doseAmount);
    this._doseUnit = props.doseUnit || "ml";
    this._cost = Number(props.cost ?? 0);
    this._notes = props.notes ?? null;
    this._administeredAt = props.administeredAt;
    this._nextDueDate = props.nextDueDate ?? null;
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._animal = props.animal ?? null;
    this._administeredBy = props.administeredBy ?? null;

    this.validateInvariants();
  }

  public static create(props: CreateVaccineRecordProps): VaccineRecordEntity {
    const now = new Date();
    return new VaccineRecordEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      animalId: props.animalId,
      administeredById: props.administeredById,
      recordType: props.recordType ?? VaccineRecordType.VACCINATION,
      vaccineName: props.vaccineName,
      batchNumber: props.batchNumber ?? null,
      doseAmount: props.doseAmount,
      doseUnit: props.doseUnit ?? "ml",
      cost: props.cost ?? 0,
      notes: props.notes ?? null,
      administeredAt: props.administeredAt,
      nextDueDate: props.nextDueDate ?? null,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  private validateInvariants(): void {
    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("VaccineRecord must belong to a farm tenant (farmId is required).");
    }
    if (!this._animalId || this._animalId.trim().length === 0) {
      throw new ValidationDomainException("VaccineRecord must be associated with an animal (animalId is required).");
    }
    if (!this._administeredById || this._administeredById.trim().length === 0) {
      throw new ValidationDomainException("VaccineRecord must have an administering user (administeredById is required).");
    }
    if (!this._vaccineName || this._vaccineName.trim().length === 0) {
      throw new ValidationDomainException("Vaccine/dewormer name is required.");
    }
    if (this._doseAmount <= 0) {
      throw new ValidationDomainException("Dose amount must be greater than zero.");
    }
    if (this._cost < 0) {
      throw new ValidationDomainException("Cost cannot be negative.");
    }
    if (this._nextDueDate) {
      const adminDate = new Date(this._administeredAt);
      adminDate.setHours(0, 0, 0, 0);
      const dueDate = new Date(this._nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate.getTime() < adminDate.getTime()) {
        throw new ValidationDomainException("Next due date cannot precede the administration date.");
      }
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

  public get administeredById(): string {
    return this._administeredById;
  }

  public get recordType(): VaccineRecordType {
    return this._recordType;
  }

  public get vaccineName(): string {
    return this._vaccineName;
  }

  public get batchNumber(): string | null {
    return this._batchNumber;
  }

  public get doseAmount(): number {
    return this._doseAmount;
  }

  public get doseUnit(): string {
    return this._doseUnit;
  }

  public get cost(): number {
    return this._cost;
  }

  public get notes(): string | null {
    return this._notes;
  }

  public get administeredAt(): Date {
    return this._administeredAt;
  }

  public get nextDueDate(): Date | null {
    return this._nextDueDate;
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

  public get animal(): HealthIncidentAnimalSummaryDto | null {
    return this._animal;
  }

  public get administeredBy(): HealthIncidentUserSummaryDto | null {
    return this._administeredBy;
  }

  public setAnimalSummary(animal: HealthIncidentAnimalSummaryDto | null): void {
    this._animal = animal;
  }

  public setAdministeredBySummary(user: HealthIncidentUserSummaryDto | null): void {
    this._administeredBy = user;
  }

  public isOverdue(asOfDate?: Date): boolean {
    if (!this._nextDueDate) {
      return false;
    }
    const today = asOfDate ?? new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(this._nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() < today.getTime();
  }

  public getScheduleStatus(asOfDate?: Date): PreventativeScheduleStatus {
    if (!this._nextDueDate) {
      return PreventativeScheduleStatus.COMPLETED;
    }
    const today = asOfDate ?? new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(this._nextDueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return PreventativeScheduleStatus.OVERDUE;
    }
    if (diffDays <= 14) {
      return PreventativeScheduleStatus.DUE_SOON;
    }
    return PreventativeScheduleStatus.UPCOMING;
  }

  public update(props: {
    recordType?: VaccineRecordType;
    vaccineName?: string;
    batchNumber?: string | null;
    doseAmount?: number;
    doseUnit?: string;
    cost?: number;
    notes?: string | null;
    administeredAt?: Date;
    nextDueDate?: Date | null;
  }): void {
    if (props.recordType !== undefined) {
      this._recordType = props.recordType;
    }
    if (props.vaccineName !== undefined) {
      if (!props.vaccineName || props.vaccineName.trim().length === 0) {
        throw new ValidationDomainException("Vaccine/dewormer name cannot be empty.");
      }
      this._vaccineName = props.vaccineName.trim();
    }
    if (props.batchNumber !== undefined) {
      this._batchNumber = props.batchNumber ? props.batchNumber.trim() : null;
    }
    if (props.doseAmount !== undefined) {
      if (props.doseAmount <= 0) {
        throw new ValidationDomainException("Dose amount must be greater than zero.");
      }
      this._doseAmount = Number(props.doseAmount);
    }
    if (props.doseUnit !== undefined) {
      this._doseUnit = props.doseUnit ? props.doseUnit.trim() : "ml";
    }
    if (props.cost !== undefined) {
      if (props.cost < 0) {
        throw new ValidationDomainException("Cost cannot be negative.");
      }
      this._cost = Number(props.cost);
    }
    if (props.notes !== undefined) {
      this._notes = props.notes ? props.notes.trim() : null;
    }
    if (props.administeredAt !== undefined) {
      this._administeredAt = props.administeredAt;
    }
    if (props.nextDueDate !== undefined) {
      if (props.nextDueDate) {
        const adminDate = new Date(this._administeredAt);
        adminDate.setHours(0, 0, 0, 0);
        const dueDate = new Date(props.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate.getTime() < adminDate.getTime()) {
          throw new ValidationDomainException("Next due date cannot precede administration date.");
        }
      }
      this._nextDueDate = props.nextDueDate;
    }

    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public toResponseDto(asOfDate?: Date): VaccineRecordResponseDto {
    const formattedDueDate = this._nextDueDate
      ? this._nextDueDate instanceof Date
        ? this._nextDueDate.toISOString().split("T")[0]!
        : String(this._nextDueDate)
      : null;

    return {
      id: this._id,
      farmId: this._farmId,
      animalId: this._animalId,
      administeredById: this._administeredById,
      recordType: this._recordType,
      vaccineName: this._vaccineName,
      batchNumber: this._batchNumber,
      doseAmount: this._doseAmount,
      doseUnit: this._doseUnit,
      cost: this._cost,
      notes: this._notes,
      administeredAt: this._administeredAt.toISOString(),
      nextDueDate: formattedDueDate,
      scheduleStatus: this.getScheduleStatus(asOfDate),
      isOverdue: this.isOverdue(asOfDate),
      syncVersion: this._syncVersion,
      animal: this._animal,
      administeredBy: this._administeredBy,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
