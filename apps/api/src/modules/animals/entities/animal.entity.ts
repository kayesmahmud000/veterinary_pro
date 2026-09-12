import {
  AnimalGender,
  AnimalPedigreeSummaryDto,
  AnimalResponseDto,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface AnimalEntityProps {
  id: string;
  farmId: string;
  tagNumber: string;
  rfidNumber: string | null;
  name: string | null;
  species: AnimalSpecies;
  breed: string | null;
  gender: AnimalGender;
  dateOfBirth: Date | null;
  weightKg: number | null;
  status: AnimalStatus;
  sireId: string | null;
  damId: string | null;
  sire?: AnimalPedigreeSummaryDto | null;
  dam?: AnimalPedigreeSummaryDto | null;
  metadata: Record<string, unknown>;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateAnimalProps {
  id?: string;
  farmId: string;
  tagNumber: string;
  rfidNumber?: string | null;
  name?: string | null;
  species: AnimalSpecies;
  breed?: string | null;
  gender: AnimalGender;
  dateOfBirth?: Date | null;
  weightKg?: number | null;
  status?: AnimalStatus;
  sireId?: string | null;
  damId?: string | null;
  metadata?: Record<string, unknown>;
}

export class AnimalEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private _tagNumber: string;
  private _rfidNumber: string | null;
  private _name: string | null;
  private _species: AnimalSpecies;
  private _breed: string | null;
  private _gender: AnimalGender;
  private _dateOfBirth: Date | null;
  private _weightKg: number | null;
  private _status: AnimalStatus;
  private _sireId: string | null;
  private _damId: string | null;
  private _sire: AnimalPedigreeSummaryDto | null;
  private _dam: AnimalPedigreeSummaryDto | null;
  private _metadata: Record<string, unknown>;
  private _syncVersion: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  private constructor(props: AnimalEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._tagNumber = props.tagNumber.trim().toUpperCase();
    this._rfidNumber =
      props.rfidNumber && props.rfidNumber.trim().length > 0
        ? props.rfidNumber.trim().toUpperCase()
        : null;
    this._name = props.name ? props.name.trim() : null;
    this._species = props.species;
    this._breed = props.breed ? props.breed.trim() : null;
    this._gender = props.gender;
    this._dateOfBirth = props.dateOfBirth;
    this._weightKg = props.weightKg !== null && props.weightKg !== undefined ? Number(props.weightKg) : null;
    this._status = props.status;
    this._sireId = props.sireId ?? null;
    this._damId = props.damId ?? null;
    this._sire = props.sire ?? null;
    this._dam = props.dam ?? null;
    this._metadata = props.metadata ?? {};
    this._syncVersion = props.syncVersion ?? 1;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt;

    this.validate();
  }

  private validate(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new ValidationDomainException("Animal ID cannot be empty.");
    }

    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("Animal farmId cannot be empty.");
    }

    if (!this._tagNumber || this._tagNumber.length === 0 || this._tagNumber.length > 50) {
      throw new ValidationDomainException(
        "Animal tag number must be between 1 and 50 characters."
      );
    }

    if (
      this._rfidNumber !== null &&
      (this._rfidNumber.length === 0 || this._rfidNumber.length > 50)
    ) {
      throw new ValidationDomainException(
        "Animal RFID number must not exceed 50 characters."
      );
    }

    if (!Object.values(AnimalSpecies).includes(this._species)) {
      throw new ValidationDomainException(`Invalid animal species: '${this._species}'.`);
    }

    if (!Object.values(AnimalGender).includes(this._gender)) {
      throw new ValidationDomainException(`Invalid animal gender: '${this._gender}'.`);
    }

    if (!Object.values(AnimalStatus).includes(this._status)) {
      throw new ValidationDomainException(`Invalid animal status: '${this._status}'.`);
    }

    if (this._dateOfBirth) {
      const now = new Date();
      if (this._dateOfBirth.getTime() > now.getTime()) {
        throw new ValidationDomainException("Animal date of birth cannot be in the future.");
      }
    }

    if (this._weightKg !== null) {
      if (isNaN(this._weightKg) || this._weightKg <= 0 || this._weightKg > 9999.99) {
        throw new ValidationDomainException(
          "Animal weight must be a positive number up to 9999.99 kg."
        );
      }
    }

    if (this._sireId && this._sireId === this._id) {
      throw new ValidationDomainException("An animal cannot be designated as its own sire.");
    }

    if (this._damId && this._damId === this._id) {
      throw new ValidationDomainException("An animal cannot be designated as its own dam.");
    }
  }

  public static create(props: CreateAnimalProps): AnimalEntity {
    const now = new Date();
    const rfid =
      props.rfidNumber && props.rfidNumber.trim().length > 0
        ? props.rfidNumber.trim().toUpperCase()
        : null;

    return new AnimalEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      tagNumber: props.tagNumber,
      rfidNumber: rfid,
      name: props.name ?? null,
      species: props.species,
      breed: props.breed ?? null,
      gender: props.gender,
      dateOfBirth: props.dateOfBirth ?? null,
      weightKg: props.weightKg ?? null,
      status: props.status ?? AnimalStatus.ACTIVE,
      sireId: props.sireId ?? null,
      damId: props.damId ?? null,
      metadata: props.metadata ?? {},
      syncVersion: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  public static reconstitute(props: AnimalEntityProps): AnimalEntity {
    return new AnimalEntity(props);
  }

  // ==========================================
  // GETTERS
  // ==========================================

  public get id(): string {
    return this._id;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get tagNumber(): string {
    return this._tagNumber;
  }

  public get rfidNumber(): string | null {
    return this._rfidNumber;
  }

  public get name(): string | null {
    return this._name;
  }

  public get species(): AnimalSpecies {
    return this._species;
  }

  public get breed(): string | null {
    return this._breed;
  }

  public get gender(): AnimalGender {
    return this._gender;
  }

  public get dateOfBirth(): Date | null {
    return this._dateOfBirth;
  }

  public get weightKg(): number | null {
    return this._weightKg;
  }

  public get status(): AnimalStatus {
    return this._status;
  }

  public get sireId(): string | null {
    return this._sireId;
  }

  public get damId(): string | null {
    return this._damId;
  }

  public get sire(): AnimalPedigreeSummaryDto | null {
    return this._sire;
  }

  public get dam(): AnimalPedigreeSummaryDto | null {
    return this._dam;
  }

  public get metadata(): Record<string, unknown> {
    return { ...this._metadata };
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

  // ==========================================
  // BUSINESS METHODS & DOMAIN RULES
  // ==========================================

  public isActive(): boolean {
    return this._deletedAt === null && this._status === AnimalStatus.ACTIVE;
  }

  public isSoftDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public isFemale(): boolean {
    return this._gender === AnimalGender.FEMALE;
  }

  public isMale(): boolean {
    return this._gender === AnimalGender.MALE;
  }

  public canProduceMilk(): boolean {
    if (!this.isFemale()) {
      return false;
    }
    const milkSpecies = [
      AnimalSpecies.COW,
      AnimalSpecies.BUFFALO,
      AnimalSpecies.GOAT,
      AnimalSpecies.SHEEP,
      AnimalSpecies.CAMEL,
    ];
    return milkSpecies.includes(this._species);
  }

  public calculateAgeMonths(atDate = new Date()): number | null {
    if (!this._dateOfBirth) {
      return null;
    }
    const diffYears = atDate.getFullYear() - this._dateOfBirth.getFullYear();
    const diffMonths = atDate.getMonth() - this._dateOfBirth.getMonth();
    const totalMonths = diffYears * 12 + diffMonths;
    return Math.max(0, totalMonths);
  }

  public setPedigree(sire: AnimalPedigreeSummaryDto | null, dam: AnimalPedigreeSummaryDto | null): void {
    this._sire = sire;
    this._dam = dam;
  }

  public updateDetails(props: {
    tagNumber?: string;
    rfidNumber?: string | null;
    name?: string | null;
    species?: AnimalSpecies;
    breed?: string | null;
    gender?: AnimalGender;
    dateOfBirth?: Date | null;
    weightKg?: number | null;
    status?: AnimalStatus;
    sireId?: string | null;
    damId?: string | null;
    metadata?: Record<string, unknown>;
  }): void {
    if (props.tagNumber !== undefined) {
      this._tagNumber = props.tagNumber.trim().toUpperCase();
    }
    if (props.rfidNumber !== undefined) {
      this._rfidNumber =
        props.rfidNumber && props.rfidNumber.trim().length > 0
          ? props.rfidNumber.trim().toUpperCase()
          : null;
    }
    if (props.name !== undefined) {
      this._name = props.name ? props.name.trim() : null;
    }
    if (props.species !== undefined) {
      this._species = props.species;
    }
    if (props.breed !== undefined) {
      this._breed = props.breed ? props.breed.trim() : null;
    }
    if (props.gender !== undefined) {
      this._gender = props.gender;
    }
    if (props.dateOfBirth !== undefined) {
      this._dateOfBirth = props.dateOfBirth;
    }
    if (props.weightKg !== undefined) {
      this._weightKg = props.weightKg !== null ? Number(props.weightKg) : null;
    }
    if (props.status !== undefined) {
      this._status = props.status;
    }
    if (props.sireId !== undefined) {
      this._sireId = props.sireId ?? null;
    }
    if (props.damId !== undefined) {
      this._damId = props.damId ?? null;
    }
    if (props.metadata !== undefined) {
      this._metadata = { ...props.metadata };
    }

    this._syncVersion += 1;
    this._updatedAt = new Date();
    this.validate();
  }

  public softDelete(deletedAt = new Date()): void {
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
    this._syncVersion += 1;
  }

  public restore(): void {
    this._deletedAt = null;
    this._updatedAt = new Date();
    this._syncVersion += 1;
  }

  // ==========================================
  // PRESENTATION MAPPER
  // ==========================================

  public toResponse(): AnimalResponseDto {
    const dobString = this._dateOfBirth
      ? this._dateOfBirth.toISOString().split("T")[0]!
      : null;

    return {
      id: this._id,
      farmId: this._farmId,
      tagNumber: this._tagNumber,
      rfidNumber: this._rfidNumber,
      name: this._name,
      species: this._species,
      breed: this._breed,
      gender: this._gender,
      dateOfBirth: dobString,
      ageMonths: this.calculateAgeMonths(),
      weightKg: this._weightKg,
      status: this._status,
      sireId: this._sireId,
      damId: this._damId,
      sire: this._sire,
      dam: this._dam,
      metadata: this._metadata,
      syncVersion: this._syncVersion,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
