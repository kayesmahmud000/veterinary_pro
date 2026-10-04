import {
  HealthAttachmentStatus,
  HealthRecordAttachmentResponseDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export const ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedHealthAttachmentMimeType =
  (typeof ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES)[number];

export const MAX_HEALTH_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export interface HealthRecordAttachmentEntityProps {
  id: string;
  farmId: string;
  healthRecordId: string;
  uploadedById: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  s3Key: string;
  status: HealthAttachmentStatus;
  caption: string | null;
  viewUrl?: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHealthRecordAttachmentProps {
  id?: string;
  farmId: string;
  healthRecordId: string;
  uploadedById: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  s3Key: string;
  caption?: string | null;
}

export class HealthRecordAttachmentEntity {
  private readonly _id: string;
  private readonly _farmId: string;
  private readonly _healthRecordId: string;
  private readonly _uploadedById: string;
  private readonly _fileName: string;
  private readonly _fileSizeBytes: number;
  private readonly _mimeType: string;
  private readonly _s3Key: string;
  private _status: HealthAttachmentStatus;
  private _caption: string | null;
  private _viewUrl?: string;
  private _confirmedAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: HealthRecordAttachmentEntityProps) {
    this._id = props.id;
    this._farmId = props.farmId;
    this._healthRecordId = props.healthRecordId;
    this._uploadedById = props.uploadedById;
    this._fileName = props.fileName;
    this._fileSizeBytes = props.fileSizeBytes;
    this._mimeType = props.mimeType;
    this._s3Key = props.s3Key;
    this._status = props.status;
    this._caption = props.caption;
    this._viewUrl = props.viewUrl;
    this._confirmedAt = props.confirmedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(
    props: CreateHealthRecordAttachmentProps
  ): HealthRecordAttachmentEntity {
    HealthRecordAttachmentEntity.validateProps(props);

    const now = new Date();
    const id = props.id ?? crypto.randomUUID();

    return new HealthRecordAttachmentEntity({
      id,
      farmId: props.farmId,
      healthRecordId: props.healthRecordId,
      uploadedById: props.uploadedById,
      fileName: props.fileName.trim(),
      fileSizeBytes: props.fileSizeBytes,
      mimeType: props.mimeType.toLowerCase().trim(),
      s3Key: props.s3Key.trim(),
      status: HealthAttachmentStatus.PENDING_UPLOAD,
      caption: props.caption?.trim() || null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(
    props: HealthRecordAttachmentEntityProps
  ): HealthRecordAttachmentEntity {
    return new HealthRecordAttachmentEntity(props);
  }

  private static validateProps(props: CreateHealthRecordAttachmentProps): void {
    if (!props.farmId || props.farmId.trim().length === 0) {
      throw new ValidationDomainException(
        "farmId is required for health record attachment"
      );
    }

    if (!props.healthRecordId || props.healthRecordId.trim().length === 0) {
      throw new ValidationDomainException(
        "healthRecordId is required for health record attachment"
      );
    }

    if (!props.uploadedById || props.uploadedById.trim().length === 0) {
      throw new ValidationDomainException(
        "uploadedById is required for health record attachment"
      );
    }

    if (!props.fileName || props.fileName.trim().length === 0) {
      throw new ValidationDomainException(
        "fileName cannot be empty for health record attachment"
      );
    }

    if (props.fileName.trim().length > 255) {
      throw new ValidationDomainException(
        "fileName exceeds maximum length of 255 characters"
      );
    }

    if (props.fileSizeBytes <= 0) {
      throw new ValidationDomainException(
        "fileSizeBytes must be greater than 0"
      );
    }

    if (props.fileSizeBytes > MAX_HEALTH_ATTACHMENT_SIZE_BYTES) {
      throw new ValidationDomainException(
        `fileSizeBytes exceeds maximum allowed limit of ${MAX_HEALTH_ATTACHMENT_SIZE_BYTES} bytes (15 MB)`
      );
    }

    const normalizedMime = props.mimeType?.toLowerCase().trim();
    if (
      !normalizedMime ||
      !ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES.includes(
        normalizedMime as AllowedHealthAttachmentMimeType
      )
    ) {
      throw new ValidationDomainException(
        `Invalid MIME type '${props.mimeType}'. Allowed types: ${ALLOWED_HEALTH_ATTACHMENT_MIME_TYPES.join(", ")}`
      );
    }

    if (!props.s3Key || props.s3Key.trim().length === 0) {
      throw new ValidationDomainException(
        "s3Key is required for health record attachment"
      );
    }
  }

  public confirm(caption?: string): void {
    this._status = HealthAttachmentStatus.CONFIRMED;
    this._confirmedAt = new Date();
    this._updatedAt = new Date();
    if (caption !== undefined) {
      this._caption = caption?.trim() || null;
    }
  }

  public updateCaption(caption: string | null): void {
    this._caption = caption?.trim() || null;
    this._updatedAt = new Date();
  }

  public setViewUrl(viewUrl: string): void {
    this._viewUrl = viewUrl;
  }

  public get id(): string {
    return this._id;
  }

  public get farmId(): string {
    return this._farmId;
  }

  public get healthRecordId(): string {
    return this._healthRecordId;
  }

  public get uploadedById(): string {
    return this._uploadedById;
  }

  public get fileName(): string {
    return this._fileName;
  }

  public get fileSizeBytes(): number {
    return this._fileSizeBytes;
  }

  public get mimeType(): string {
    return this._mimeType;
  }

  public get s3Key(): string {
    return this._s3Key;
  }

  public get status(): HealthAttachmentStatus {
    return this._status;
  }

  public get isConfirmed(): boolean {
    return this._status === HealthAttachmentStatus.CONFIRMED;
  }

  public get caption(): string | null {
    return this._caption;
  }

  public get viewUrl(): string | undefined {
    return this._viewUrl;
  }

  public get confirmedAt(): Date | null {
    return this._confirmedAt;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public toResponseDto(viewUrl?: string): HealthRecordAttachmentResponseDto {
    return {
      id: this._id,
      farmId: this._farmId,
      healthRecordId: this._healthRecordId,
      uploadedById: this._uploadedById,
      fileName: this._fileName,
      fileSizeBytes: this._fileSizeBytes,
      mimeType: this._mimeType,
      s3Key: this._s3Key,
      status: this._status,
      caption: this._caption,
      viewUrl: viewUrl ?? this._viewUrl,
      confirmedAt: this._confirmedAt ? this._confirmedAt.toISOString() : null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
