import {
  VetProfileDto,
  VetWorkingHoursDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface VetProfileEntityProps {
  id: string;
  userId: string;
  licenseNumber?: string | null;
  specialties: string[];
  isAvailable: boolean;
  maxActiveCases: number;
  workingHours: VetWorkingHoursDto[];
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface CreateVetProfileProps {
  id?: string;
  userId: string;
  licenseNumber?: string | null;
  specialties?: string[];
  isAvailable?: boolean;
  maxActiveCases?: number;
  workingHours?: VetWorkingHoursDto[];
  timezone?: string;
  now?: Date;
}

export class VetProfileEntity {
  private readonly _id: string;
  private readonly _userId: string;
  private _licenseNumber: string | null;
  private _specialties: string[];
  private _isAvailable: boolean;
  private _maxActiveCases: number;
  private _workingHours: VetWorkingHoursDto[];
  private _timezone: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;

  private constructor(props: VetProfileEntityProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._licenseNumber = props.licenseNumber ?? null;
    this._specialties = props.specialties;
    this._isAvailable = props.isAvailable;
    this._maxActiveCases = props.maxActiveCases;
    this._workingHours = props.workingHours;
    this._timezone = props.timezone;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._user = props.user ?? null;
  }

  public static create(props: CreateVetProfileProps): VetProfileEntity {
    if (!props.userId) {
      throw new ValidationDomainException("User ID is required to create a vet profile");
    }

    const now = props.now ?? new Date();

    return new VetProfileEntity({
      id: props.id ?? crypto.randomUUID(),
      userId: props.userId,
      licenseNumber: props.licenseNumber?.trim() || null,
      specialties: props.specialties ?? [],
      isAvailable: props.isAvailable ?? true,
      maxActiveCases: props.maxActiveCases ?? 5,
      workingHours: props.workingHours ?? [],
      timezone: props.timezone ?? "UTC",
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromPersistence(record: any): VetProfileEntity {
    return new VetProfileEntity({
      id: record.id,
      userId: record.userId,
      licenseNumber: record.licenseNumber ?? null,
      specialties: Array.isArray(record.specialties) ? record.specialties : [],
      isAvailable: record.isAvailable ?? true,
      maxActiveCases: record.maxActiveCases ?? 5,
      workingHours: Array.isArray(record.workingHours) ? record.workingHours : [],
      timezone: record.timezone ?? "UTC",
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      user: record.user
        ? {
            id: record.user.id,
            name: record.user.name,
            email: record.user.email,
            avatarUrl: record.user.avatarUrl ?? null,
          }
        : null,
    });
  }

  public update(props: {
    licenseNumber?: string | null;
    specialties?: string[];
    isAvailable?: boolean;
    maxActiveCases?: number;
    workingHours?: VetWorkingHoursDto[];
    timezone?: string;
    now?: Date;
  }): void {
    if (props.licenseNumber !== undefined) {
      this._licenseNumber = props.licenseNumber?.trim() || null;
    }
    if (props.specialties !== undefined) {
      this._specialties = [...props.specialties];
    }
    if (props.isAvailable !== undefined) {
      this._isAvailable = props.isAvailable;
    }
    if (props.maxActiveCases !== undefined) {
      if (props.maxActiveCases < 1 || props.maxActiveCases > 50) {
        throw new ValidationDomainException("maxActiveCases must be between 1 and 50");
      }
      this._maxActiveCases = props.maxActiveCases;
    }
    if (props.workingHours !== undefined) {
      this._workingHours = [...props.workingHours];
    }
    if (props.timezone !== undefined) {
      this._timezone = props.timezone;
    }
    this._updatedAt = props.now ?? new Date();
  }

  public matchesSpecialty(species?: string | null): {
    matches: boolean;
    isExact: boolean;
  } {
    if (!species) {
      return { matches: true, isExact: false };
    }

    const speciesUpper = species.toUpperCase();
    const upperSpecialties = this._specialties.map((s) => s.toUpperCase());

    if (upperSpecialties.includes(speciesUpper)) {
      return { matches: true, isExact: true };
    }

    if (
      upperSpecialties.includes("GENERAL") ||
      upperSpecialties.includes("MIXED") ||
      upperSpecialties.length === 0
    ) {
      return { matches: true, isExact: false };
    }

    return { matches: false, isExact: false };
  }

  public isAvailableAt(scheduledAt?: Date | null): boolean {
    if (!this._isAvailable) {
      return false;
    }

    if (!scheduledAt || this._workingHours.length === 0) {
      return true;
    }

    // Check day of week: 1 (Monday) to 7 (Sunday)
    const dayOfWeek = scheduledAt.getUTCDay() === 0 ? 7 : scheduledAt.getUTCDay();
    const hours = String(scheduledAt.getUTCHours()).padStart(2, "0");
    const minutes = String(scheduledAt.getUTCMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    const matchingDaySlots = this._workingHours.filter(
      (slot) => slot.dayOfWeek === dayOfWeek,
    );

    if (matchingDaySlots.length === 0) {
      return false;
    }

    return matchingDaySlots.some(
      (slot) => timeStr >= slot.startTime && timeStr <= slot.endTime,
    );
  }

  public canAcceptMoreCases(currentActiveCases: number): boolean {
    return currentActiveCases < this._maxActiveCases;
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get licenseNumber(): string | null {
    return this._licenseNumber;
  }

  public get specialties(): string[] {
    return [...this._specialties];
  }

  public get isAvailable(): boolean {
    return this._isAvailable;
  }

  public get maxActiveCases(): number {
    return this._maxActiveCases;
  }

  public get workingHours(): VetWorkingHoursDto[] {
    return [...this._workingHours];
  }

  public get timezone(): string {
    return this._timezone;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get user(): {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null {
    return this._user;
  }

  public toDto(): VetProfileDto {
    return {
      id: this._id,
      userId: this._userId,
      specialties: [...this._specialties],
      isAvailable: this._isAvailable,
      maxActiveCases: this._maxActiveCases,
      workingHours: [...this._workingHours],
      timezone: this._timezone,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      user: this._user,
    };
  }
}
