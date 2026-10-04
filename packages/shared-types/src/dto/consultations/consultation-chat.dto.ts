import { ConsultationMessageType, UserRole } from "../../enums";

export interface ChatMediaAttachment {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConsultationMessageDto {
  id: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  mediaUrls: ChatMediaAttachment[];
  messageType: ConsultationMessageType;
  readAt?: string | null;
  createdAt: string;
}

export interface CreateConsultationMessageDto {
  content: string;
  mediaUrls?: ChatMediaAttachment[];
  messageType?: ConsultationMessageType;
}

export interface QueryConsultationMessagesDto {
  page?: number;
  limit?: number;
  before?: string;
}

export interface MarkMessagesReadDto {
  messageIds: string[];
}

export interface ChatMediaUploadUrlDto {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface ChatMediaUploadResponseDto {
  uploadUrl: string;
  mediaUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}

export interface ChatClientToServerEvents {
  join_room: (data: { consultationId: string }) => void;
  leave_room: (data: { consultationId: string }) => void;
  send_message: (data: {
    consultationId: string;
    content: string;
    mediaUrls?: ChatMediaAttachment[];
    messageType?: ConsultationMessageType;
  }) => void;
  typing_indicator: (data: {
    consultationId: string;
    isTyping: boolean;
  }) => void;
  mark_as_read: (data: {
    consultationId: string;
    messageIds: string[];
  }) => void;
}

export interface ChatServerToClientEvents {
  user_joined: (data: { userId: string; role: string }) => void;
  user_left: (data: { userId: string }) => void;
  new_message: (message: ConsultationMessageDto) => void;
  user_typing: (data: { userId: string; isTyping: boolean }) => void;
  messages_read: (data: {
    userId: string;
    readAt: string;
    messageIds: string[];
  }) => void;
  error: (data: { message: string; code?: string }) => void;
}
