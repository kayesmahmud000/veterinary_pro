import {
  ChatMediaUploadResponseDto,
  ChatMediaUploadUrlDto,
  ConsultationMessageDto,
  CreateConsultationMessageDto,
  JwtPayload,
  MarkMessagesReadDto,
  QueryConsultationMessagesDto,
} from "@vetralink/shared-types";

export const CONSULTATION_CHAT_SERVICE = Symbol("CONSULTATION_CHAT_SERVICE");

export interface IConsultationChatService {
  sendMessage(
    consultationId: string,
    sender: JwtPayload,
    dto: CreateConsultationMessageDto,
    traceId?: string,
  ): Promise<ConsultationMessageDto>;

  getMessages(
    consultationId: string,
    requestingUser: JwtPayload,
    query: QueryConsultationMessagesDto,
  ): Promise<{
    items: ConsultationMessageDto[];
    total: number;
    page: number;
    limit: number;
  }>;

  generateMediaUploadUrl(
    consultationId: string,
    requestingUser: JwtPayload,
    dto: ChatMediaUploadUrlDto,
  ): Promise<ChatMediaUploadResponseDto>;

  markMessagesRead(
    consultationId: string,
    requestingUser: JwtPayload,
    dto: MarkMessagesReadDto,
  ): Promise<{ updatedCount: number }>;
}
