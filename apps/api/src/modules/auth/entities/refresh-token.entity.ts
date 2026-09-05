import * as crypto from "crypto";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface RefreshTokenEntityProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateRefreshTokenProps {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class RefreshTokenEntity {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _tokenHash: string;
  private readonly _expiresAt: Date;
  private _revokedAt: Date | null;
  private readonly _ipAddress: string | null;
  private readonly _userAgent: string | null;
  private readonly _createdAt: Date;

  private constructor(props: RefreshTokenEntityProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._tokenHash = props.tokenHash;
    this._expiresAt = props.expiresAt;
    this._revokedAt = props.revokedAt;
    this._ipAddress = props.ipAddress;
    this._userAgent = props.userAgent;
    this._createdAt = props.createdAt;

    this.validate();
  }

  private validate(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new ValidationDomainException("RefreshToken id cannot be empty.");
    }
    if (!this._userId || this._userId.trim().length === 0) {
      throw new ValidationDomainException("RefreshToken userId cannot be empty.");
    }
    if (!this._tokenHash || this._tokenHash.trim().length === 0) {
      throw new ValidationDomainException("RefreshToken tokenHash cannot be empty.");
    }
    if (!(this._expiresAt instanceof Date) || isNaN(this._expiresAt.getTime())) {
      throw new ValidationDomainException("RefreshToken expiresAt must be a valid Date.");
    }
  }

  public static create(props: CreateRefreshTokenProps): RefreshTokenEntity {
    const now = new Date();
    return new RefreshTokenEntity({
      id: props.id ?? crypto.randomUUID(),
      userId: props.userId,
      tokenHash: props.tokenHash,
      expiresAt: props.expiresAt,
      revokedAt: null,
      ipAddress: props.ipAddress ?? null,
      userAgent: props.userAgent ?? null,
      createdAt: now,
    });
  }

  public static reconstitute(props: RefreshTokenEntityProps): RefreshTokenEntity {
    return new RefreshTokenEntity(props);
  }

  // ==========================================
  // GETTERS
  // ==========================================

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get tokenHash(): string {
    return this._tokenHash;
  }

  public get expiresAt(): Date {
    return this._expiresAt;
  }

  public get revokedAt(): Date | null {
    return this._revokedAt;
  }

  public get ipAddress(): string | null {
    return this._ipAddress;
  }

  public get userAgent(): string | null {
    return this._userAgent;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  // ==========================================
  // DOMAIN METHODS & INVARIANTS
  // ==========================================

  public isValid(now = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  public isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  public isExpired(now = new Date()): boolean {
    return now.getTime() >= this._expiresAt.getTime();
  }

  public revoke(revokedAt = new Date()): void {
    if (this._revokedAt === null) {
      this._revokedAt = revokedAt;
    }
  }
}
