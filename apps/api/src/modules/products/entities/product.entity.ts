import {
  ProductListItemDto,
  ProductResponseDto,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ProductEntityProps {
  id: string;
  title: string;
  slug: string;
  type: ProductType;
  description: string;
  priceCents: number;
  discountPriceCents: number | null;
  currency: string;
  contentS3Key: string;
  minSubscriptionTier: SubscriptionTier;
  isPublished: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateProductProps {
  id?: string;
  title: string;
  slug?: string;
  type: ProductType;
  description: string;
  priceCents: number;
  discountPriceCents?: number | null;
  currency?: string;
  contentS3Key: string;
  minSubscriptionTier?: SubscriptionTier;
  isPublished?: boolean;
  metadata?: Record<string, unknown>;
}

export class ProductEntity {
  private readonly _id: string;
  private _title: string;
  private _slug: string;
  private _type: ProductType;
  private _description: string;
  private _priceCents: number;
  private _discountPriceCents: number | null;
  private _currency: string;
  private _contentS3Key: string;
  private _minSubscriptionTier: SubscriptionTier;
  private _isPublished: boolean;
  private _metadata: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  private constructor(props: ProductEntityProps) {
    this._id = props.id;
    this._title = props.title.trim();
    this._slug = props.slug.trim().toLowerCase();
    this._type = props.type;
    this._description = props.description.trim();
    this._priceCents = Math.round(props.priceCents);
    this._discountPriceCents =
      props.discountPriceCents !== null && props.discountPriceCents !== undefined
        ? Math.round(props.discountPriceCents)
        : null;
    this._currency = props.currency.toUpperCase().trim();
    this._contentS3Key = props.contentS3Key.trim();
    this._minSubscriptionTier = props.minSubscriptionTier;
    this._isPublished = props.isPublished;
    this._metadata = props.metadata ?? {};
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt;

    this.validate();
  }

  private validate(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new ValidationDomainException("Product id cannot be empty.");
    }

    if (!this._title || this._title.length < 3) {
      throw new ValidationDomainException(
        "Product title must be at least 3 characters long."
      );
    }

    if (!this._slug || this._slug.length < 3) {
      throw new ValidationDomainException(
        "Product slug must be at least 3 characters long."
      );
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(this._slug)) {
      throw new ValidationDomainException(
        "Product slug must consist only of lowercase alphanumeric characters separated by single hyphens."
      );
    }

    if (!this._description || this._description.length < 10) {
      throw new ValidationDomainException(
        "Product description must be at least 10 characters long."
      );
    }

    if (!Number.isInteger(this._priceCents) || this._priceCents < 0) {
      throw new ValidationDomainException(
        "Product price in cents must be a non-negative integer."
      );
    }

    if (this._discountPriceCents !== null) {
      if (
        !Number.isInteger(this._discountPriceCents) ||
        this._discountPriceCents < 0
      ) {
        throw new ValidationDomainException(
          "Product discount price in cents must be a non-negative integer."
        );
      }
      if (this._discountPriceCents >= this._priceCents) {
        throw new ValidationDomainException(
          "Product discount price must be strictly less than the regular price."
        );
      }
    }

    if (!this._contentS3Key || this._contentS3Key.trim().length === 0) {
      throw new ValidationDomainException(
        "Product content S3 storage key cannot be empty."
      );
    }

    if (!this._currency || this._currency.length !== 3) {
      throw new ValidationDomainException(
        "Product currency must be a 3-letter ISO code (e.g. USD)."
      );
    }
  }

  public static formatSlug(title: string): string {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove non-alphanumeric except spaces and hyphens
      .replace(/[\s_-]+/g, "-") // Replace spaces, underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Trim hyphens from extremities
    return slug || "product";
  }

  public static create(props: CreateProductProps): ProductEntity {
    const now = new Date();
    const slug = props.slug ? props.slug.trim().toLowerCase() : this.formatSlug(props.title);

    return new ProductEntity({
      id: props.id ?? crypto.randomUUID(),
      title: props.title,
      slug,
      type: props.type,
      description: props.description,
      priceCents: props.priceCents,
      discountPriceCents: props.discountPriceCents ?? null,
      currency: props.currency ?? "USD",
      contentS3Key: props.contentS3Key,
      minSubscriptionTier: props.minSubscriptionTier ?? SubscriptionTier.STARTER,
      isPublished: props.isPublished ?? false,
      metadata: props.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  public static reconstitute(props: ProductEntityProps): ProductEntity {
    return new ProductEntity(props);
  }

  // ==========================================
  // GETTERS
  // ==========================================

  public get id(): string {
    return this._id;
  }

  public get title(): string {
    return this._title;
  }

  public get slug(): string {
    return this._slug;
  }

  public get type(): ProductType {
    return this._type;
  }

  public get description(): string {
    return this._description;
  }

  public get priceCents(): number {
    return this._priceCents;
  }

  public get discountPriceCents(): number | null {
    return this._discountPriceCents;
  }

  public get effectivePriceCents(): number {
    return this._discountPriceCents ?? this._priceCents;
  }

  public get currency(): string {
    return this._currency;
  }

  public get contentS3Key(): string {
    return this._contentS3Key;
  }

  public get minSubscriptionTier(): SubscriptionTier {
    return this._minSubscriptionTier;
  }

  public get isPublished(): boolean {
    return this._isPublished;
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

  public get deletedAt(): Date | null {
    return this._deletedAt;
  }

  // ==========================================
  // BUSINESS METHODS & STATE MUTATIONS
  // ==========================================

  public isFree(): boolean {
    return this.effectivePriceCents === 0;
  }

  public isDiscounted(): boolean {
    return this._discountPriceCents !== null && this._discountPriceCents < this._priceCents;
  }

  public isActive(): boolean {
    return this._deletedAt === null;
  }

  public isVideo(): boolean {
    return this._type === ProductType.VIDEO_COURSE;
  }

  public isEbook(): boolean {
    return this._type === ProductType.EBOOK;
  }

  public isExcelTool(): boolean {
    return this._type === ProductType.EXCEL_TOOL;
  }

  public publish(): void {
    this._isPublished = true;
    this._updatedAt = new Date();
  }

  public unpublish(): void {
    this._isPublished = false;
    this._updatedAt = new Date();
  }

  public updatePricing(
    priceCents?: number,
    discountPriceCents?: number | null,
    currency?: string
  ): void {
    if (priceCents !== undefined) {
      this._priceCents = Math.round(priceCents);
    }
    if (discountPriceCents !== undefined) {
      this._discountPriceCents =
        discountPriceCents !== null ? Math.round(discountPriceCents) : null;
    }
    if (currency !== undefined) {
      this._currency = currency.toUpperCase().trim();
    }
    this._updatedAt = new Date();
    this.validate();
  }

  public updateDetails(props: {
    title?: string;
    slug?: string;
    description?: string;
    type?: ProductType;
    minSubscriptionTier?: SubscriptionTier;
    contentS3Key?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (props.title !== undefined) {
      this._title = props.title.trim();
    }
    if (props.slug !== undefined) {
      this._slug = props.slug.trim().toLowerCase();
    }
    if (props.description !== undefined) {
      this._description = props.description.trim();
    }
    if (props.type !== undefined) {
      this._type = props.type;
    }
    if (props.minSubscriptionTier !== undefined) {
      this._minSubscriptionTier = props.minSubscriptionTier;
    }
    if (props.contentS3Key !== undefined) {
      this._contentS3Key = props.contentS3Key.trim();
    }
    if (props.metadata !== undefined) {
      this._metadata = { ...props.metadata };
    }

    this._updatedAt = new Date();
    this.validate();
  }

  public softDelete(deletedAt = new Date()): void {
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
  }

  public restore(): void {
    this._deletedAt = null;
    this._updatedAt = new Date();
  }

  // ==========================================
  // PRESENTATION MAPPERS
  // ==========================================

  public toResponse(includeAssetKey = false): ProductResponseDto {
    return {
      id: this._id,
      title: this._title,
      slug: this._slug,
      type: this._type,
      description: this._description,
      priceCents: this._priceCents,
      discountPriceCents: this._discountPriceCents,
      effectivePriceCents: this.effectivePriceCents,
      currency: this._currency,
      minSubscriptionTier: this._minSubscriptionTier,
      isPublished: this._isPublished,
      metadata: this._metadata,
      contentS3Key: includeAssetKey ? this._contentS3Key : undefined,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  public toListItem(): ProductListItemDto {
    return {
      id: this._id,
      title: this._title,
      slug: this._slug,
      type: this._type,
      priceCents: this._priceCents,
      discountPriceCents: this._discountPriceCents,
      effectivePriceCents: this.effectivePriceCents,
      currency: this._currency,
      minSubscriptionTier: this._minSubscriptionTier,
      isPublished: this._isPublished,
      metadata: this._metadata,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
