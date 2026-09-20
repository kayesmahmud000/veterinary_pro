import {
  ConsultationReviewDto,
  ReviewModerationStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ConsultationReviewProps {
  id: string;
  consultationId: string;
  farmerId: string;
  vetId: string;
  rating: number;
  feedback?: string | null;
  tags?: string[];
  isPublic?: boolean;
  moderationStatus?: ReviewModerationStatus;
  moderatedById?: string | null;
  moderatedAt?: Date | null;
  moderationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  farmer?: { id: string; name: string } | null;
  vet?: { id: string; name: string } | null;
}

export interface CreateConsultationReviewProps {
  id?: string;
  consultationId: string;
  farmerId: string;
  vetId: string;
  rating: number;
  feedback?: string | null;
  tags?: string[];
  isPublic?: boolean;
}

export class ConsultationReviewEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _farmerId: string;
  private readonly _vetId: string;
  private _rating: number;
  private _feedback: string | null;
  private _tags: string[];
  private _isPublic: boolean;
  private _moderationStatus: ReviewModerationStatus;
  private _moderatedById: string | null;
  private _moderatedAt: Date | null;
  private _moderationReason: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _farmer?: { id: string; name: string } | null;
  private _vet?: { id: string; name: string } | null;

  private constructor(props: ConsultationReviewProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._farmerId = props.farmerId;
    this._vetId = props.vetId;
    this._rating = props.rating;
    this._feedback = props.feedback ?? null;
    this._tags = props.tags ?? [];
    this._isPublic = props.isPublic ?? true;
    this._moderationStatus =
      props.moderationStatus ?? ReviewModerationStatus.APPROVED;
    this._moderatedById = props.moderatedById ?? null;
    this._moderatedAt = props.moderatedAt ?? null;
    this._moderationReason = props.moderationReason ?? null;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._farmer = props.farmer ?? null;
    this._vet = props.vet ?? null;

    this.validateInvariants();
  }

  public static create(
    props: CreateConsultationReviewProps,
  ): ConsultationReviewEntity {
    const now = new Date();
    return new ConsultationReviewEntity({
      id: props.id ?? crypto.randomUUID(),
      consultationId: props.consultationId,
      farmerId: props.farmerId,
      vetId: props.vetId,
      rating: props.rating,
      feedback: props.feedback ?? null,
      tags: props.tags ?? [],
      isPublic: props.isPublic ?? true,
      moderationStatus: ReviewModerationStatus.APPROVED,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static fromPersistence(
    props: ConsultationReviewProps,
  ): ConsultationReviewEntity {
    return new ConsultationReviewEntity(props);
  }

  private validateInvariants(): void {
    if (!this._consultationId || this._consultationId.trim() === "") {
      throw new ValidationDomainException(
        "Consultation ID is required for a review.",
      );
    }
    if (!this._farmerId || this._farmerId.trim() === "") {
      throw new ValidationDomainException(
        "Farmer ID is required for a review.",
      );
    }
    if (!this._vetId || this._vetId.trim() === "") {
      throw new ValidationDomainException(
        "Veterinarian ID is required for a review.",
      );
    }
    if (
      !Number.isInteger(this._rating) ||
      this._rating < 1 ||
      this._rating > 5
    ) {
      throw new ValidationDomainException(
        "Rating must be an integer between 1 and 5 stars.",
      );
    }
    if (this._feedback && this._feedback.length > 1000) {
      throw new ValidationDomainException(
        "Feedback cannot exceed 1000 characters.",
      );
    }
  }

  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get farmerId(): string {
    return this._farmerId;
  }

  public get vetId(): string {
    return this._vetId;
  }

  public get rating(): number {
    return this._rating;
  }

  public get feedback(): string | null {
    return this._feedback;
  }

  public get tags(): string[] {
    return this._tags;
  }

  public get isPublic(): boolean {
    return this._isPublic;
  }

  public get moderationStatus(): ReviewModerationStatus {
    return this._moderationStatus;
  }

  public get moderatedById(): string | null {
    return this._moderatedById;
  }

  public get moderatedAt(): Date | null {
    return this._moderatedAt;
  }

  public get moderationReason(): string | null {
    return this._moderationReason;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get farmer(): { id: string; name: string } | null | undefined {
    return this._farmer;
  }

  public get vet(): { id: string; name: string } | null | undefined {
    return this._vet;
  }

  public approve(moderatorId?: string, reason?: string): void {
    this._moderationStatus = ReviewModerationStatus.APPROVED;
    this._moderatedById = moderatorId ?? null;
    this._moderatedAt = new Date();
    this._moderationReason = reason ?? null;
    this._updatedAt = new Date();
  }

  public flag(moderatorId?: string, reason?: string): void {
    this._moderationStatus = ReviewModerationStatus.FLAGGED;
    this._moderatedById = moderatorId ?? null;
    this._moderatedAt = new Date();
    this._moderationReason = reason ?? null;
    this._updatedAt = new Date();
  }

  public reject(moderatorId?: string, reason?: string): void {
    this._moderationStatus = ReviewModerationStatus.REJECTED;
    this._moderatedById = moderatorId ?? null;
    this._moderatedAt = new Date();
    this._moderationReason = reason ?? null;
    this._updatedAt = new Date();
  }

  public toDto(): ConsultationReviewDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      farmerId: this._farmerId,
      vetId: this._vetId,
      rating: this._rating,
      feedback: this._feedback,
      tags: this._tags,
      isPublic: this._isPublic,
      moderationStatus: this._moderationStatus,
      moderatedById: this._moderatedById,
      moderatedAt: this._moderatedAt ? this._moderatedAt.toISOString() : null,
      moderationReason: this._moderationReason,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      farmer: this._farmer,
      vet: this._vet,
    };
  }
}
