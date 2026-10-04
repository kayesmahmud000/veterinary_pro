import { UserRole, UserStatus } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface UserEntityProps {
  id: string;
  email: string;
  phone: string | null;
  phoneHash: string | null;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserProps {
  id?: string;
  email: string;
  phone?: string | null;
  phoneHash?: string | null;
  passwordHash: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
  avatarUrl?: string | null;
  isEmailVerified?: boolean;
}

export class UserEntity {
  private readonly _id: string;
  private _email: string;
  private _phone: string | null;
  private _phoneHash: string | null;
  private _passwordHash: string;
  private _name: string;
  private _role: UserRole;
  private _status: UserStatus;
  private _avatarUrl: string | null;
  private _isEmailVerified: boolean;
  private _lastLoginAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  private constructor(props: UserEntityProps) {
    this._id = props.id;
    this._email = props.email.toLowerCase().trim();
    this._phone = props.phone;
    this._phoneHash = props.phoneHash;
    this._passwordHash = props.passwordHash;
    this._name = props.name.trim();
    this._role = props.role;
    this._status = props.status;
    this._avatarUrl = props.avatarUrl;
    this._isEmailVerified = props.isEmailVerified;
    this._lastLoginAt = props.lastLoginAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt;

    this.validate();
  }

  private validate(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new ValidationDomainException("User id cannot be empty.");
    }
    if (!this._email || !this._email.includes("@")) {
      throw new ValidationDomainException("User email must be a valid email address.");
    }
    if (!this._name || this._name.trim().length === 0) {
      throw new ValidationDomainException("User name cannot be empty.");
    }
    if (!this._passwordHash || this._passwordHash.trim().length === 0) {
      throw new ValidationDomainException("User passwordHash cannot be empty.");
    }
  }

  public static create(props: CreateUserProps): UserEntity {
    const now = new Date();
    return new UserEntity({
      id: props.id ?? crypto.randomUUID(),
      email: props.email,
      phone: props.phone ?? null,
      phoneHash: props.phoneHash ?? null,
      passwordHash: props.passwordHash,
      name: props.name,
      role: props.role ?? UserRole.FARMER,
      status: props.status ?? UserStatus.ACTIVE,
      avatarUrl: props.avatarUrl ?? null,
      isEmailVerified: props.isEmailVerified ?? false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  public static reconstitute(props: UserEntityProps): UserEntity {
    return new UserEntity(props);
  }

  // ==========================================
  // GETTERS
  // ==========================================

  public get id(): string {
    return this._id;
  }

  public get email(): string {
    return this._email;
  }

  public get phone(): string | null {
    return this._phone;
  }

  public get phoneHash(): string | null {
    return this._phoneHash;
  }

  public get passwordHash(): string {
    return this._passwordHash;
  }

  public get name(): string {
    return this._name;
  }

  public get role(): UserRole {
    return this._role;
  }

  public get status(): UserStatus {
    return this._status;
  }

  public get avatarUrl(): string | null {
    return this._avatarUrl;
  }

  public get isEmailVerified(): boolean {
    return this._isEmailVerified;
  }

  public get lastLoginAt(): Date | null {
    return this._lastLoginAt;
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
  // BUSINESS METHODS & STATE MUTATIONS
  // ==========================================

  public isActive(): boolean {
    return this._status === UserStatus.ACTIVE && this._deletedAt === null;
  }

  public isSuspended(): boolean {
    return this._status === UserStatus.SUSPENDED;
  }

  public isPendingVerification(): boolean {
    return this._status === UserStatus.PENDING_VERIFICATION;
  }

  public isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public hasRole(role: UserRole): boolean {
    return this._role === role;
  }

  public updateProfile(name?: string, avatarUrl?: string | null): void {
    if (name !== undefined) {
      if (name.trim().length === 0) {
        throw new ValidationDomainException("Name cannot be blank.");
      }
      this._name = name.trim();
    }
    if (avatarUrl !== undefined) {
      this._avatarUrl = avatarUrl;
    }
    this._updatedAt = new Date();
  }

  public changePhone(newPhone: string, newPhoneHash: string): void {
    if (!newPhone || newPhone.trim().length === 0) {
      throw new ValidationDomainException("Phone number cannot be blank.");
    }
    if (!newPhoneHash || newPhoneHash.trim().length === 0) {
      throw new ValidationDomainException("Phone hash cannot be blank.");
    }
    this._phone = newPhone;
    this._phoneHash = newPhoneHash;
    this._updatedAt = new Date();
  }

  public removePhone(): void {
    this._phone = null;
    this._phoneHash = null;
    this._updatedAt = new Date();
  }

  public verifyEmail(): void {
    this._isEmailVerified = true;
    this._updatedAt = new Date();
  }

  public updatePassword(newPasswordHash: string): void {
    if (!newPasswordHash || newPasswordHash.trim().length === 0) {
      throw new ValidationDomainException("Password hash cannot be blank.");
    }
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }

  public recordLogin(loginTime = new Date()): void {
    this._lastLoginAt = loginTime;
    this._updatedAt = loginTime;
  }

  public suspend(): void {
    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  public reactivate(): void {
    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  public softDelete(deletedAt = new Date()): void {
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
  }

  public maskPhone(): string | null {
    if (!this._phone) {
      return null;
    }
    const clean = this._phone.trim();
    if (clean.length <= 4) {
      return clean;
    }
    const lastFour = clean.slice(-4);
    const prefix = clean.startsWith("+") ? clean.slice(0, 4) : clean.slice(0, 2);
    return `${prefix} •••• ${lastFour}`;
  }

  /**
   * Safe serialization for external presentation.
   * Strips passwordHash and ciphertext to prevent accidental leakage.
   */
  public toSafeObject(): Omit<UserEntityProps, "passwordHash"> & { maskedPhone: string | null } {
    return {
      id: this._id,
      email: this._email,
      phone: this._phone,
      phoneHash: this._phoneHash,
      maskedPhone: this.maskPhone(),
      name: this._name,
      role: this._role,
      status: this._status,
      avatarUrl: this._avatarUrl,
      isEmailVerified: this._isEmailVerified,
      lastLoginAt: this._lastLoginAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt,
    };
  }
}
