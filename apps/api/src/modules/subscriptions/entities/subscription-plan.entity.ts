import {
  SubscriptionTier,
  SubscriptionPlanFeaturesDto,
  isUnlimitedQuota,
  UNLIMITED_ANIMALS_SENTINEL,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanResponseDto } from "../dto/subscription-plan-response.dto";

export interface SubscriptionPlanEntityProps {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxAnimals: number;
  features: SubscriptionPlanFeaturesDto;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateSubscriptionPlanEntityProps {
  id?: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxAnimals: number;
  features?: SubscriptionPlanFeaturesDto;
  isActive?: boolean;
  createdAt?: Date;
}

export class SubscriptionPlanEntity {
  private readonly _id: string;
  private _name: string;
  private readonly _tier: SubscriptionTier;
  private _priceMonthlyCents: number;
  private _priceAnnualCents: number;
  private _maxAnimals: number;
  private _features: SubscriptionPlanFeaturesDto;
  private _isActive: boolean;
  private readonly _createdAt: Date;

  private constructor(props: SubscriptionPlanEntityProps) {
    this._id = props.id;
    this._name = props.name;
    this._tier = props.tier;
    this._priceMonthlyCents = props.priceMonthlyCents;
    this._priceAnnualCents = props.priceAnnualCents;
    this._maxAnimals = props.maxAnimals;
    this._features = props.features;
    this._isActive = props.isActive;
    this._createdAt = props.createdAt;
  }

  public static create(props: CreateSubscriptionPlanEntityProps): SubscriptionPlanEntity {
    SubscriptionPlanEntity.validate(props);

    const defaultFeatures: SubscriptionPlanFeaturesDto = {
      maxAnimals: props.maxAnimals,
      maxStaff: props.tier === SubscriptionTier.ENTERPRISE ? -1 : props.tier === SubscriptionTier.PRO ? 3 : 1,
      teleVetPriority:
        props.tier === SubscriptionTier.ENTERPRISE
          ? "PRIORITY"
          : props.tier === SubscriptionTier.PRO
            ? "EXPEDITED"
            : "STANDARD",
      advancedAnalytics: props.tier !== SubscriptionTier.STARTER,
      bulkImportExport: props.tier !== SubscriptionTier.STARTER,
      customReports: props.tier === SubscriptionTier.ENTERPRISE,
    };

    return new SubscriptionPlanEntity({
      id: props.id ?? crypto.randomUUID(),
      name: props.name.trim(),
      tier: props.tier,
      priceMonthlyCents: props.priceMonthlyCents,
      priceAnnualCents: props.priceAnnualCents,
      maxAnimals: props.maxAnimals,
      features: props.features ? { ...defaultFeatures, ...props.features } : defaultFeatures,
      isActive: props.isActive ?? true,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  public static fromPersistence(raw: {
    id: string;
    name: string;
    tier: SubscriptionTier | string;
    priceMonthlyCents: number;
    priceAnnualCents: number;
    maxAnimals: number;
    features: unknown;
    isActive: boolean;
    createdAt: Date;
  }): SubscriptionPlanEntity {
    const features =
      typeof raw.features === "object" && raw.features !== null
        ? (raw.features as SubscriptionPlanFeaturesDto)
        : {
            maxAnimals: raw.maxAnimals,
            maxStaff: 1,
            teleVetPriority: "STANDARD" as const,
            advancedAnalytics: false,
            bulkImportExport: false,
            customReports: false,
          };

    return new SubscriptionPlanEntity({
      id: raw.id,
      name: raw.name,
      tier: raw.tier as SubscriptionTier,
      priceMonthlyCents: raw.priceMonthlyCents,
      priceAnnualCents: raw.priceAnnualCents,
      maxAnimals: raw.maxAnimals,
      features,
      isActive: raw.isActive,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    });
  }

  private static validate(props: CreateSubscriptionPlanEntityProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new ValidationDomainException("Subscription plan name cannot be empty");
    }
    if (props.name.trim().length > 100) {
      throw new ValidationDomainException("Subscription plan name cannot exceed 100 characters");
    }
    if (!Object.values(SubscriptionTier).includes(props.tier)) {
      throw new ValidationDomainException(`Invalid subscription tier: ${props.tier}`);
    }
    if (props.priceMonthlyCents < 0) {
      throw new ValidationDomainException("Monthly price cannot be negative");
    }
    if (props.priceAnnualCents < 0) {
      throw new ValidationDomainException("Annual price cannot be negative");
    }
    if (props.maxAnimals < UNLIMITED_ANIMALS_SENTINEL) {
      throw new ValidationDomainException("Max animals cannot be less than -1 (sentinel for unlimited)");
    }
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get tier(): SubscriptionTier {
    return this._tier;
  }

  public get priceMonthlyCents(): number {
    return this._priceMonthlyCents;
  }

  public get priceAnnualCents(): number {
    return this._priceAnnualCents;
  }

  public get maxAnimals(): number {
    return this._maxAnimals;
  }

  public get features(): SubscriptionPlanFeaturesDto {
    return { ...this._features };
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  // Domain Business Methods
  public isUnlimitedAnimals(): boolean {
    return isUnlimitedQuota(this._maxAnimals);
  }

  public canAccommodateAnimals(currentCount: number): boolean {
    if (currentCount < 0) {
      return false;
    }
    if (this.isUnlimitedAnimals()) {
      return true;
    }
    return currentCount < this._maxAnimals;
  }

  public allowsStaffCount(currentStaffCount: number): boolean {
    const maxStaff = this._features.maxStaff ?? 1;
    if (isUnlimitedQuota(maxStaff)) {
      return true;
    }
    return currentStaffCount <= maxStaff;
  }

  public hasFeature(featureKey: string): boolean {
    return Boolean(this._features[featureKey]);
  }

  public calculateAnnualSavingsCents(): number {
    const annualizedMonthly = this._priceMonthlyCents * 12;
    return Math.max(0, annualizedMonthly - this._priceAnnualCents);
  }

  // Mutators
  public updateDetails(params: {
    name?: string;
    priceMonthlyCents?: number;
    priceAnnualCents?: number;
    maxAnimals?: number;
    features?: SubscriptionPlanFeaturesDto;
    isActive?: boolean;
  }): void {
    if (params.name !== undefined) {
      if (!params.name || params.name.trim().length === 0) {
        throw new ValidationDomainException("Subscription plan name cannot be empty");
      }
      this._name = params.name.trim();
    }
    if (params.priceMonthlyCents !== undefined) {
      if (params.priceMonthlyCents < 0) {
        throw new ValidationDomainException("Monthly price cannot be negative");
      }
      this._priceMonthlyCents = params.priceMonthlyCents;
    }
    if (params.priceAnnualCents !== undefined) {
      if (params.priceAnnualCents < 0) {
        throw new ValidationDomainException("Annual price cannot be negative");
      }
      this._priceAnnualCents = params.priceAnnualCents;
    }
    if (params.maxAnimals !== undefined) {
      if (params.maxAnimals < UNLIMITED_ANIMALS_SENTINEL) {
        throw new ValidationDomainException("Max animals cannot be less than -1");
      }
      this._maxAnimals = params.maxAnimals;
    }
    if (params.features !== undefined) {
      this._features = { ...this._features, ...params.features };
    }
    if (params.isActive !== undefined) {
      this._isActive = params.isActive;
    }
  }

  public toResponseDto(): SubscriptionPlanResponseDto {
    return {
      id: this._id,
      name: this._name,
      tier: this._tier,
      priceMonthlyCents: this._priceMonthlyCents,
      priceAnnualCents: this._priceAnnualCents,
      maxAnimals: this._maxAnimals,
      features: this.features,
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      annualSavingsCents: this.calculateAnnualSavingsCents(),
      isUnlimitedAnimals: this.isUnlimitedAnimals(),
    };
  }
}
