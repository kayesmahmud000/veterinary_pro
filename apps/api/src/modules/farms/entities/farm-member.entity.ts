import * as crypto from "crypto";
import { FarmRole } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface FarmMemberEntityProps {
  id: string;
  farmId: string;
  userId: string;
  role: FarmRole;
  createdAt: Date;
}

export interface CreateFarmMemberProps {
  id?: string;
  farmId: string;
  userId: string;
  role?: FarmRole;
}

export class FarmMemberEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _userId: string;
  private _role: FarmRole;
  private readonly _createdAt: Date;

  private constructor(props: FarmMemberEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._userId = props.userId;
    this._role = props.role;
    this._createdAt = props.createdAt;

    this.validate();
  }

  private validate(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new ValidationDomainException("FarmMember id cannot be empty.");
    }
    if (!this._farmId || this._farmId.trim().length === 0) {
      throw new ValidationDomainException("FarmMember farmId cannot be empty.");
    }
    if (!this._userId || this._userId.trim().length === 0) {
      throw new ValidationDomainException("FarmMember userId cannot be empty.");
    }
    if (!Object.values(FarmRole).includes(this._role)) {
      throw new ValidationDomainException(
        `Invalid FarmMember role: '${this._role}'.`
      );
    }
  }

  public static create(props: CreateFarmMemberProps): FarmMemberEntity {
    return new FarmMemberEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId: props.farmId,
      userId: props.userId,
      role: props.role ?? FarmRole.HERDSMAN,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: FarmMemberEntityProps): FarmMemberEntity {
    return new FarmMemberEntity(props);
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

  public get userId(): string {
    return this._userId;
  }

  public get role(): FarmRole {
    return this._role;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  // ==========================================
  // BUSINESS METHODS & PREDICATES
  // ==========================================

  public isOwner(): boolean {
    return this._role === FarmRole.OWNER;
  }

  public isManager(): boolean {
    return this._role === FarmRole.MANAGER;
  }

  public canManageLivestock(): boolean {
    return (
      this._role === FarmRole.OWNER ||
      this._role === FarmRole.MANAGER ||
      this._role === FarmRole.HERDSMAN
    );
  }

  public canManageHealth(): boolean {
    return (
      this._role === FarmRole.OWNER ||
      this._role === FarmRole.MANAGER ||
      this._role === FarmRole.VET_STAFF
    );
  }

  public canManageFinances(): boolean {
    return this._role === FarmRole.OWNER || this._role === FarmRole.MANAGER;
  }

  public changeRole(newRole: FarmRole): void {
    if (!Object.values(FarmRole).includes(newRole)) {
      throw new ValidationDomainException(`Invalid FarmRole '${newRole}'.`);
    }
    this._role = newRole;
  }
}
