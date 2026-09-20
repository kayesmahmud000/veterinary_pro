import {
  ClinicalNoteCategory,
  ClinicalNoteDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ConsultationClinicalNoteProps {
  id: string;
  consultationId: string;
  authorVetId: string;
  title: string;
  content: string;
  category: ClinicalNoteCategory;
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorVetName?: string;
}

export interface CreateClinicalNoteProps {
  consultationId: string;
  authorVetId: string;
  title: string;
  content: string;
  category?: ClinicalNoteCategory;
  isConfidential?: boolean;
  authorVetName?: string;
}

export class ConsultationClinicalNoteEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _authorVetId: string;
  private _title: string;
  private _content: string;
  private _category: ClinicalNoteCategory;
  private _isConfidential: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _authorVetName?: string;

  private constructor(props: ConsultationClinicalNoteProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._authorVetId = props.authorVetId;
    this._title = props.title;
    this._content = props.content;
    this._category = props.category;
    this._isConfidential = props.isConfidential;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._authorVetName = props.authorVetName;
  }

  public static create(
    props: CreateClinicalNoteProps,
  ): ConsultationClinicalNoteEntity {
    if (!props.consultationId || props.consultationId.trim() === "") {
      throw new ValidationDomainException(
        "Consultation ID is required for a clinical note.",
      );
    }

    if (!props.authorVetId || props.authorVetId.trim() === "") {
      throw new ValidationDomainException(
        "Author veterinarian ID is required for a clinical note.",
      );
    }

    const trimmedTitle = (props.title || "").trim();
    if (!trimmedTitle) {
      throw new ValidationDomainException("Clinical note title is required.");
    }
    if (trimmedTitle.length > 200) {
      throw new ValidationDomainException(
        "Clinical note title cannot exceed 200 characters.",
      );
    }

    const trimmedContent = (props.content || "").trim();
    if (!trimmedContent) {
      throw new ValidationDomainException(
        "Clinical note content cannot be empty.",
      );
    }

    const now = new Date();
    return new ConsultationClinicalNoteEntity({
      id: crypto.randomUUID(),
      consultationId: props.consultationId,
      authorVetId: props.authorVetId,
      title: trimmedTitle,
      content: trimmedContent,
      category: props.category ?? ClinicalNoteCategory.GENERAL,
      isConfidential: props.isConfidential ?? true,
      createdAt: now,
      updatedAt: now,
      authorVetName: props.authorVetName,
    });
  }

  public static fromPersistence(raw: any): ConsultationClinicalNoteEntity {
    return new ConsultationClinicalNoteEntity({
      id: raw.id,
      consultationId: raw.consultationId,
      authorVetId: raw.authorVetId,
      title: raw.title,
      content: raw.content,
      category: raw.category as ClinicalNoteCategory,
      isConfidential: raw.isConfidential,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      authorVetName: raw.authorVet?.name,
    });
  }

  public update(props: {
    title?: string;
    content?: string;
    category?: ClinicalNoteCategory;
    isConfidential?: boolean;
  }): void {
    if (props.title !== undefined) {
      const trimmedTitle = props.title.trim();
      if (!trimmedTitle) {
        throw new ValidationDomainException("Clinical note title is required.");
      }
      if (trimmedTitle.length > 200) {
        throw new ValidationDomainException(
          "Clinical note title cannot exceed 200 characters.",
        );
      }
      this._title = trimmedTitle;
    }

    if (props.content !== undefined) {
      const trimmedContent = props.content.trim();
      if (!trimmedContent) {
        throw new ValidationDomainException(
          "Clinical note content cannot be empty.",
        );
      }
      this._content = trimmedContent;
    }

    if (props.category !== undefined) {
      this._category = props.category;
    }

    if (props.isConfidential !== undefined) {
      this._isConfidential = props.isConfidential;
    }

    this._updatedAt = new Date();
  }

  public toDto(): ClinicalNoteDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      authorVetId: this._authorVetId,
      authorVetName: this._authorVetName ?? "Attending Veterinarian",
      title: this._title,
      content: this._content,
      category: this._category,
      isConfidential: this._isConfidential,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get authorVetId(): string {
    return this._authorVetId;
  }

  public get title(): string {
    return this._title;
  }

  public get content(): string {
    return this._content;
  }

  public get category(): ClinicalNoteCategory {
    return this._category;
  }

  public get isConfidential(): boolean {
    return this._isConfidential;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get authorVetName(): string | undefined {
    return this._authorVetName;
  }
}
