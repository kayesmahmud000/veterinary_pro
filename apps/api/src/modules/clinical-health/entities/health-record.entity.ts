import {
  HealthEventType,
  SeverityLevel,
  HealthIncidentResponseDto,
  HealthIncidentAnimalSummaryDto,
  HealthIncidentUserSummaryDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface HealthRecordEntityProps {
  id: string;
  farmId: string;
  animalId: string;
  recordedById: string;
  attendingVetId: string | null;
  eventType: HealthEventType;
  severity: SeverityLevel;
  symptoms: string;
  diagnosis: string | null;
  treatment: string | null;
  cost: number;
  resolvedAt: Date | null;
  escalationLevel?: number;
  lastEscalatedAt?: Date | null;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
  animal?: HealthIncidentAnimalSummaryDto | null;
  recordedBy?: HealthIncidentUserSummaryDto | null;
  attendingVet?: HealthIncidentUserSummaryDto | null;
}

export interface CreateHealthRecordProps {
  id?: string;
  farmId: string;
  animalId: string;
  recordedById: string;
  attendingVetId?: string | null;
  eventType: HealthEventType;
  severity?: SeverityLevel;
  symptoms: string;
  diagnosis?: string | null;
  treatment?: string | null;
  cost?: number;
  resolvedAt?: Date | null;
  escalationLevel?: number;
  lastEscalatedAt?: Date | null;
}

export class HealthRecordEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _animalId: string;
  private readonly _recordedById: string;
  private _attendingVetId: string | null;
  private _eventType: HealthEventType;
  private _severity: SeverityLevel;
  private _symptoms: string;
  private _diagnosis: string | null;
  private _treatment: string | null;
  private _cost: number;
  private _resolvedAt: Date | null;
  private _escalationLevel: number;
  private _lastEscalatedAt: Date | null;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _animal: HealthIncidentAnimalSummaryDto | null;
  private _recordedBy: HealthIncidentUserSummaryDto | null;
  private _attendingVet: HealthIncidentUserSummaryDto | null;

  constructor(props: HealthRecordEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._recordedById = props.recordedById;
    this._attendingVetId = props.attendingVetId ?? null;
    this._eventType = props.eventType;
    this._severity = props.severity ?? SeverityLevel.LOW;
    this._symptoms = props.symptoms;
    this._diagnosis = props.diagnosis ?? null;
    this._treatment = props.treatment ?? null;
    this._cost = Number(props.cost ?? 0);
    this._resolvedAt = props.resolvedAt ?? null;
    this._escalationLevel = props.escalationLevel ?? 0;
    this._lastEscalatedAt = props.lastEscalatedAt ?? null;
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._animal = props.animal ?? null;
    this._recordedBy = props.recordedBy ?? null;
    this._attendingVet = props.attendingVet ?? null;

    this.validateInvariants();
  }

  public static create(props: CreateHealthRecordProps): HealthRecordEntity {
    const now = new Date();
    return new HealthRecordEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      animalId: props.animalId,
      recordedById: props.recordedById,
      attendingVetId: props.attendingVetId ?? null,
      eventType: props.eventType,
      severity: props.severity ?? SeverityLevel.LOW,
      symptoms: props.symptoms,
      diagnosis: props.diagnosis ?? null,
      treatment: props.treatment ?? null,
      cost: props.cost ?? 0,
      resolvedAt: props.resolvedAt ?? null,
      escalationLevel: props.escalationLevel ?? 0,
      lastEscalatedAt: props.lastEscalatedAt ?? null,
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  private validateInvariants(): void {
    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("HealthRecord must belong to a farm tenant (farmId is required).");
    }
    if (!this._animalId || this._animalId.trim().length === 0) {
      throw new ValidationDomainException("HealthRecord must be associated with an animal (animalId is required).");
    }
    if (!this._recordedById || this._recordedById.trim().length === 0) {
      throw new ValidationDomainException("HealthRecord must have a recording user (recordedById is required).");
    }
    if (!this._symptoms || this._symptoms.trim().length < 3) {
      throw new ValidationDomainException("Symptoms description must be at least 3 characters long.");
    }
    if (this._cost < 0) {
      throw new ValidationDomainException("Treatment cost cannot be negative.");
    }
    if (this._resolvedAt && this._resolvedAt.getTime() < this._createdAt.getTime()) {
      throw new ValidationDomainException("Incident resolution timestamp cannot precede the incident creation timestamp.");
    }
    if (!Object.values(HealthEventType).includes(this._eventType)) {
      throw new ValidationDomainException(`Invalid health event type: ${this._eventType}`);
    }
    if (!Object.values(SeverityLevel).includes(this._severity)) {
      throw new ValidationDomainException(`Invalid severity level: ${this._severity}`);
    }
    if (this._escalationLevel < 0) {
      throw new ValidationDomainException("Escalation level cannot be negative.");
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

  public get attendingVetId(): string | null {
    return this._attendingVetId;
  }

  public get eventType(): HealthEventType {
    return this._eventType;
  }

  public get severity(): SeverityLevel {
    return this._severity;
  }

  public get symptoms(): string {
    return this._symptoms;
  }

  public get diagnosis(): string | null {
    return this._diagnosis;
  }

  public get treatment(): string | null {
    return this._treatment;
  }

  public get cost(): number {
    return this._cost;
  }

  public get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  public get isResolved(): boolean {
    return this._resolvedAt !== null;
  }

  public get escalationLevel(): number {
    return this._escalationLevel;
  }

  public get lastEscalatedAt(): Date | null {
    return this._lastEscalatedAt;
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

  public escalateTo(level: number, at?: Date): void {
    if (level < this._escalationLevel) {
      throw new ValidationDomainException("Cannot downgrade escalation level.");
    }
    this._escalationLevel = level;
    this._lastEscalatedAt = at ?? new Date();
    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public get animal(): HealthIncidentAnimalSummaryDto | null {
    return this._animal;
  }

  public get recordedBy(): HealthIncidentUserSummaryDto | null {
    return this._recordedBy;
  }

  public get attendingVet(): HealthIncidentUserSummaryDto | null {
    return this._attendingVet;
  }

  public setAnimalSummary(animal: HealthIncidentAnimalSummaryDto | null): void {
    this._animal = animal;
  }

  public setRecordedBySummary(user: HealthIncidentUserSummaryDto | null): void {
    this._recordedBy = user;
  }

  public setAttendingVetSummary(vet: HealthIncidentUserSummaryDto | null): void {
    this._attendingVet = vet;
  }

  public update(props: {
    eventType?: HealthEventType;
    severity?: SeverityLevel;
    symptoms?: string;
    diagnosis?: string | null;
    treatment?: string | null;
    cost?: number;
    attendingVetId?: string | null;
    resolvedAt?: Date | null;
  }): void {
    if (props.eventType !== undefined) {
      if (!Object.values(HealthEventType).includes(props.eventType)) {
        throw new ValidationDomainException(`Invalid health event type: ${props.eventType}`);
      }
      this._eventType = props.eventType;
    }
    if (props.severity !== undefined) {
      if (!Object.values(SeverityLevel).includes(props.severity)) {
        throw new ValidationDomainException(`Invalid severity level: ${props.severity}`);
      }
      this._severity = props.severity;
    }
    if (props.symptoms !== undefined) {
      if (!props.symptoms || props.symptoms.trim().length < 3) {
        throw new ValidationDomainException("Symptoms description must be at least 3 characters long.");
      }
      this._symptoms = props.symptoms.trim();
    }
    if (props.diagnosis !== undefined) {
      this._diagnosis = props.diagnosis !== null ? props.diagnosis.trim() : null;
    }
    if (props.treatment !== undefined) {
      this._treatment = props.treatment !== null ? props.treatment.trim() : null;
    }
    if (props.cost !== undefined) {
      if (props.cost < 0) {
        throw new ValidationDomainException("Treatment cost cannot be negative.");
      }
      this._cost = Number(props.cost);
    }
    if (props.attendingVetId !== undefined) {
      this._attendingVetId = props.attendingVetId;
    }
    if (props.resolvedAt !== undefined) {
      if (props.resolvedAt && props.resolvedAt.getTime() < this._createdAt.getTime()) {
        throw new ValidationDomainException("Incident resolution timestamp cannot precede the incident creation timestamp.");
      }
      this._resolvedAt = props.resolvedAt;
    }

    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public resolve(props: {
    resolvedAt?: Date | null;
    diagnosis?: string | null;
    treatment?: string | null;
    cost?: number;
  }): void {
    const resolutionDate = props.resolvedAt ?? new Date();
    if (resolutionDate.getTime() < this._createdAt.getTime()) {
      throw new ValidationDomainException("Incident resolution timestamp cannot precede the incident creation timestamp.");
    }
    this._resolvedAt = resolutionDate;

    if (props.diagnosis !== undefined && props.diagnosis !== null) {
      this._diagnosis = props.diagnosis.trim();
    }
    if (props.treatment !== undefined && props.treatment !== null) {
      this._treatment = props.treatment.trim();
    }
    if (props.cost !== undefined) {
      if (props.cost < 0) {
        throw new ValidationDomainException("Treatment cost cannot be negative.");
      }
      this._cost = Number(props.cost);
    }

    this._syncVersion += 1;
    this._updatedAt = new Date();
  }

  public toResponseDto(): HealthIncidentResponseDto {
    return {
      id: this._id,
      farmId: this._farmId,
      animalId: this._animalId,
      recordedById: this._recordedById,
      attendingVetId: this._attendingVetId,
      eventType: this._eventType,
      severity: this._severity,
      symptoms: this._symptoms,
      diagnosis: this._diagnosis,
      treatment: this._treatment,
      cost: Number(this._cost),
      resolvedAt: this._resolvedAt ? this._resolvedAt.toISOString() : null,
      isResolved: this.isResolved,
      escalationLevel: this._escalationLevel,
      lastEscalatedAt: this._lastEscalatedAt ? this._lastEscalatedAt.toISOString() : null,
      syncVersion: this._syncVersion,
      animal: this._animal,
      recordedBy: this._recordedBy,
      attendingVet: this._attendingVet,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
