import {
  ChatMediaAttachment,
  ConsultationMessageDto,
  ConsultationMessageType,
  UserRole,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface ConsultationMessageProps {
  id: string;
  consultationId: string;
  senderId: string;
  content: string;
  mediaUrls: ChatMediaAttachment[];
  messageType: ConsultationMessageType;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  senderName?: string;
  senderRole?: UserRole;
}

export interface CreateMessageProps {
  consultationId: string;
  senderId: string;
  content: string;
  mediaUrls?: ChatMediaAttachment[];
  messageType?: ConsultationMessageType;
  senderName?: string;
  senderRole?: UserRole;
}

export class ConsultationMessageEntity {
  private readonly _id: string;
  private readonly _consultationId: string;
  private readonly _senderId: string;
  private _content: string;
  private _mediaUrls: ChatMediaAttachment[];
  private _messageType: ConsultationMessageType;
  private _readAt: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _senderName?: string;
  private _senderRole?: UserRole;

  private constructor(props: ConsultationMessageProps) {
    this._id = props.id;
    this._consultationId = props.consultationId;
    this._senderId = props.senderId;
    this._content = props.content;
    this._mediaUrls = props.mediaUrls;
    this._messageType = props.messageType;
    this._readAt = props.readAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._senderName = props.senderName;
    this._senderRole = props.senderRole;
  }

  public static create(props: CreateMessageProps): ConsultationMessageEntity {
    if (!props.consultationId || props.consultationId.trim() === "") {
      throw new ValidationDomainException(
        "Consultation ID is required for a chat message.",
      );
    }

    if (!props.senderId || props.senderId.trim() === "") {
      throw new ValidationDomainException(
        "Sender ID is required for a chat message.",
      );
    }

    const trimmedContent = (props.content || "").trim();
    const mediaAttachments = props.mediaUrls ?? [];

    if (!trimmedContent && mediaAttachments.length === 0) {
      throw new ValidationDomainException(
        "Chat message cannot be empty. Please provide text content or media attachments.",
      );
    }

    let resolvedType = props.messageType ?? ConsultationMessageType.TEXT;
    if (mediaAttachments.length > 0 && resolvedType === ConsultationMessageType.TEXT) {
      const firstMime = mediaAttachments[0]?.mimeType || "";
      if (firstMime.startsWith("image/")) {
        resolvedType = ConsultationMessageType.IMAGE;
      } else if (firstMime.startsWith("video/")) {
        resolvedType = ConsultationMessageType.VIDEO;
      } else if (firstMime.startsWith("audio/")) {
        resolvedType = ConsultationMessageType.AUDIO;
      } else {
        resolvedType = ConsultationMessageType.DOCUMENT;
      }
    }

    const now = new Date();
    return new ConsultationMessageEntity({
      id: crypto.randomUUID(),
      consultationId: props.consultationId,
      senderId: props.senderId,
      content: trimmedContent,
      mediaUrls: mediaAttachments,
      messageType: resolvedType,
      readAt: null,
      createdAt: now,
      updatedAt: now,
      senderName: props.senderName,
      senderRole: props.senderRole,
    });
  }

  public static fromPersistence(raw: any): ConsultationMessageEntity {
    const rawMedia = Array.isArray(raw.mediaUrls)
      ? raw.mediaUrls
      : typeof raw.mediaUrls === "string"
        ? JSON.parse(raw.mediaUrls)
        : [];

    return new ConsultationMessageEntity({
      id: raw.id,
      consultationId: raw.consultationId,
      senderId: raw.senderId,
      content: raw.content,
      mediaUrls: rawMedia,
      messageType: raw.messageType as ConsultationMessageType,
      readAt: raw.readAt ? new Date(raw.readAt) : null,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      senderName: raw.sender?.name,
      senderRole: raw.sender?.role as UserRole,
    });
  }

  public markAsRead(readAt?: Date): void {
    if (!this._readAt) {
      this._readAt = readAt ?? new Date();
      this._updatedAt = new Date();
    }
  }

  public toDto(): ConsultationMessageDto {
    return {
      id: this._id,
      consultationId: this._consultationId,
      senderId: this._senderId,
      senderName: this._senderName ?? "Unknown",
      senderRole: this._senderRole ?? UserRole.FARMER,
      content: this._content,
      mediaUrls: this._mediaUrls,
      messageType: this._messageType,
      readAt: this._readAt ? this._readAt.toISOString() : null,
      createdAt: this._createdAt.toISOString(),
    };
  }

  // Getters
  public get id(): string {
    return this._id;
  }

  public get consultationId(): string {
    return this._consultationId;
  }

  public get senderId(): string {
    return this._senderId;
  }

  public get content(): string {
    return this._content;
  }

  public get mediaUrls(): ChatMediaAttachment[] {
    return [...this._mediaUrls];
  }

  public get messageType(): ConsultationMessageType {
    return this._messageType;
  }

  public get readAt(): Date | null {
    return this._readAt;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get senderName(): string | undefined {
    return this._senderName;
  }

  public get senderRole(): UserRole | undefined {
    return this._senderRole;
  }
}
