import {
  MilkAnomalyResponseDto,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";

export interface MilkYieldAnomalyAnimalProps {
  id: string;
  tagNumber: string;
  name: string | null;
  species: string;
  breed: string | null;
}

export interface MilkYieldAnomalyUserProps {
  id: string;
  name: string;
  email: string;
}

export interface MilkYieldAnomalyProps {
  id: string;
  farmId: string;
  animalId: string;
  loggedDate: Date;
  currentYieldLiters: number;
  baselineYieldLiters: number;
  dropPercentage: number;
  severity: MilkAnomalySeverity;
  status: MilkAnomalyStatus;
  acknowledgedById: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  clinicalNotes: string | null;
  resolutionNotes: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  animal?: MilkYieldAnomalyAnimalProps | null;
  acknowledgedBy?: MilkYieldAnomalyUserProps | null;
}

export class MilkYieldAnomalyEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _animalId: string;
  private _loggedDate: Date;
  private _currentYieldLiters: number;
  private _baselineYieldLiters: number;
  private _dropPercentage: number;
  private _severity: MilkAnomalySeverity;
  private _status: MilkAnomalyStatus;
  private _acknowledgedById: string | null;
  private _acknowledgedAt: Date | null;
  private _resolvedAt: Date | null;
  private _clinicalNotes: string | null;
  private _resolutionNotes: string | null;
  private _metadata: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _animal: MilkYieldAnomalyAnimalProps | null;
  private _acknowledgedBy: MilkYieldAnomalyUserProps | null;

  constructor(props: MilkYieldAnomalyProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._animalId = props.animalId;
    this._loggedDate = props.loggedDate;
    this._currentYieldLiters = props.currentYieldLiters;
    this._baselineYieldLiters = props.baselineYieldLiters;
    this._dropPercentage = props.dropPercentage;
    this._severity = props.severity;
    this._status = props.status;
    this._acknowledgedById = props.acknowledgedById;
    this._acknowledgedAt = props.acknowledgedAt;
    this._resolvedAt = props.resolvedAt;
    this._clinicalNotes = props.clinicalNotes;
    this._resolutionNotes = props.resolutionNotes;
    this._metadata = props.metadata ?? {};
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._animal = props.animal ?? null;
    this._acknowledgedBy = props.acknowledgedBy ?? null;
  }

  public static create(
    props: Omit<
      MilkYieldAnomalyProps,
      "id" | "status" | "acknowledgedById" | "acknowledgedAt" | "resolvedAt" | "clinicalNotes" | "resolutionNotes" | "createdAt" | "updatedAt"
    > & { id?: string }
  ): MilkYieldAnomalyEntity {
    return new MilkYieldAnomalyEntity({
      ...props,
      id: props.id ?? crypto.randomUUID(),
      status: MilkAnomalyStatus.DETECTED,
      acknowledgedById: null,
      acknowledgedAt: null,
      resolvedAt: null,
      clinicalNotes: null,
      resolutionNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
  public get loggedDate(): Date {
    return this._loggedDate;
  }
  public get currentYieldLiters(): number {
    return this._currentYieldLiters;
  }
  public get baselineYieldLiters(): number {
    return this._baselineYieldLiters;
  }
  public get dropPercentage(): number {
    return this._dropPercentage;
  }
  public get severity(): MilkAnomalySeverity {
    return this._severity;
  }
  public get status(): MilkAnomalyStatus {
    return this._status;
  }
  public get acknowledgedById(): string | null {
    return this._acknowledgedById;
  }
  public get acknowledgedAt(): Date | null {
    return this._acknowledgedAt;
  }
  public get resolvedAt(): Date | null {
    return this._resolvedAt;
  }
  public get clinicalNotes(): string | null {
    return this._clinicalNotes;
  }
  public get resolutionNotes(): string | null {
    return this._resolutionNotes;
  }
  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  public get createdAt(): Date {
    return this._createdAt;
  }
  public get updatedAt(): Date {
    return this._updatedAt;
  }
  public get animal(): MilkYieldAnomalyAnimalProps | null {
    return this._animal;
  }
  public get acknowledgedBy(): MilkYieldAnomalyUserProps | null {
    return this._acknowledgedBy;
  }

  public updateMetrics(
    currentYieldLiters: number,
    baselineYieldLiters: number,
    dropPercentage: number,
    severity: MilkAnomalySeverity,
    metadata?: Record<string, unknown>
  ): void {
    this._currentYieldLiters = currentYieldLiters;
    this._baselineYieldLiters = baselineYieldLiters;
    this._dropPercentage = dropPercentage;
    this._severity = severity;
    if (metadata) {
      this._metadata = { ...this._metadata, ...metadata };
    }
    this._updatedAt = new Date();
  }

  public acknowledge(userId: string, notes?: string): void {
    this._status = MilkAnomalyStatus.ACKNOWLEDGED;
    this._acknowledgedById = userId;
    this._acknowledgedAt = new Date();
    if (notes) {
      this._clinicalNotes = notes;
    }
    this._updatedAt = new Date();
  }

  public resolve(
    userId: string,
    notes?: string,
    status: MilkAnomalyStatus = MilkAnomalyStatus.RESOLVED
  ): void {
    this._status = status;
    this._resolvedAt = new Date();
    if (notes) {
      this._resolutionNotes = notes;
    }
    if (!this._acknowledgedById) {
      this._acknowledgedById = userId;
      this._acknowledgedAt = new Date();
    }
    this._updatedAt = new Date();
  }

  public toResponseDto(): MilkAnomalyResponseDto {
    return {
      id: this._id,
      farmId: this._farmId,
      animalId: this._animalId,
      loggedDate: this._loggedDate.toISOString().split("T")[0]!,
      currentYieldLiters: this._currentYieldLiters,
      baselineYieldLiters: this._baselineYieldLiters,
      dropPercentage: this._dropPercentage,
      severity: this._severity,
      status: this._status,
      acknowledgedById: this._acknowledgedById,
      acknowledgedAt: this._acknowledgedAt ? this._acknowledgedAt.toISOString() : null,
      resolvedAt: this._resolvedAt ? this._resolvedAt.toISOString() : null,
      clinicalNotes: this._clinicalNotes,
      resolutionNotes: this._resolutionNotes,
      metadata: this._metadata,
      animal: this._animal,
      acknowledgedBy: this._acknowledgedBy,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
