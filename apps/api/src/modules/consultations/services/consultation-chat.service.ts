import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ChatMediaUploadResponseDto,
  ChatMediaUploadUrlDto,
  ConsultationMessageDto,
  ConsultationStatus,
  CreateConsultationMessageDto,
  JwtPayload,
  MarkMessagesReadDto,
  QueryConsultationMessagesDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../../media/services/s3-storage.service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationMessageEntity } from "../entities/consultation-message.entity";
import {
  CONSULTATION_MESSAGE_REPOSITORY,
  IConsultationMessageRepository,
} from "../repositories/consultation-message.repository.interface";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import { IConsultationChatService } from "./consultation-chat.service.interface";

const ALLOWED_CHAT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/ogg",
  "application/pdf",
]);

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class ConsultationChatService implements IConsultationChatService {
  private readonly logger = new Logger(ConsultationChatService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(CONSULTATION_MESSAGE_REPOSITORY)
    private readonly messageRepo: IConsultationMessageRepository,
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3Storage: IS3StorageService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
  ) {}

  public async sendMessage(
    consultationId: string,
    sender: JwtPayload,
    dto: CreateConsultationMessageDto,
    traceId?: string,
  ): Promise<ConsultationMessageDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyUserAccess(consultation, sender);

    if (
      consultation.status === ConsultationStatus.COMPLETED ||
      consultation.status === ConsultationStatus.CANCELLED
    ) {
      throw new ValidationDomainException(
        "Cannot send messages to a closed or cancelled consultation.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: sender.sub },
      select: { name: true },
    });

    const entity = ConsultationMessageEntity.create({
      consultationId,
      senderId: sender.sub,
      content: dto.content,
      mediaUrls: dto.mediaUrls,
      messageType: dto.messageType,
      senderName: user?.name ?? "User",
      senderRole: sender.role,
    });

    const saved = await this.messageRepo.create(entity);

    if (saved.mediaUrls.length > 0) {
      await this.auditLogRepo.record({
        userId: sender.sub,
        action: "CONSULTATION_CHAT_MEDIA_SHARED",
        entityType: "ConsultationMessage",
        entityId: saved.id,
        newValues: {
          consultationId,
          attachmentsCount: saved.mediaUrls.length,
          mediaUrls: saved.mediaUrls.map((m) => m.url),
        },
        traceId: traceId ?? crypto.randomUUID(),
      });
    }

    this.logger.log(
      `Message '${saved.id}' sent by user '${sender.sub}' in consultation '${consultationId}' (${saved.messageType})`,
    );

    return saved.toDto();
  }

  public async getMessages(
    consultationId: string,
    requestingUser: JwtPayload,
    query: QueryConsultationMessagesDto,
  ): Promise<{
    items: ConsultationMessageDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyUserAccess(consultation, requestingUser);

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const before = query.before ? new Date(query.before) : undefined;

    const result = await this.messageRepo.findByConsultation(
      consultationId,
      page,
      limit,
      before,
    );

    return {
      items: result.items.map((m) => m.toDto()),
      total: result.total,
      page,
      limit,
    };
  }

  public async generateMediaUploadUrl(
    consultationId: string,
    requestingUser: JwtPayload,
    dto: ChatMediaUploadUrlDto,
  ): Promise<ChatMediaUploadResponseDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyUserAccess(consultation, requestingUser);

    if (
      consultation.status === ConsultationStatus.COMPLETED ||
      consultation.status === ConsultationStatus.CANCELLED
    ) {
      throw new ValidationDomainException(
        "Cannot upload media attachments to a closed or cancelled consultation.",
      );
    }

    if (
      dto.fileSizeBytes <= 0 ||
      dto.fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES
    ) {
      throw new ValidationDomainException(
        `Media attachment size must be between 1 byte and 25 MB (provided: ${dto.fileSizeBytes} bytes).`,
      );
    }

    if (!ALLOWED_CHAT_MIME_TYPES.has(dto.contentType)) {
      throw new ValidationDomainException(
        `Unsupported media type '${dto.contentType}'. Allowed types: JPEG, PNG, WEBP, GIF, MP4, MOV, MP3, WAV, AAC, OGG, PDF.`,
      );
    }

    const cleanFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `consultations/${consultationId}/chat/${crypto.randomUUID()}-${cleanFileName}`;
    const bucket = this.envService.s3BucketMedia;
    const expiresInSeconds = 900;

    const uploadUrl = await this.s3Storage.getPresignedPutUrl(
      bucket,
      s3Key,
      dto.contentType,
      expiresInSeconds,
    );

    const mediaUrl = this.envService.s3Endpoint
      ? `${this.envService.s3Endpoint}/${bucket}/${s3Key}`
      : `https://${bucket}.s3.${this.envService.awsRegion}.amazonaws.com/${s3Key}`;

    return {
      uploadUrl,
      mediaUrl,
      s3Key,
      expiresInSeconds,
    };
  }

  public async markMessagesRead(
    consultationId: string,
    requestingUser: JwtPayload,
    dto: MarkMessagesReadDto,
  ): Promise<{ updatedCount: number }> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    await this.verifyUserAccess(consultation, requestingUser);

    if (!dto.messageIds || dto.messageIds.length === 0) {
      return { updatedCount: 0 };
    }

    const updatedCount = await this.messageRepo.markAsRead(
      consultationId,
      dto.messageIds,
      new Date(),
    );

    return { updatedCount };
  }

  private async verifyUserAccess(
    consultation: any,
    requestingUser: JwtPayload,
  ): Promise<void> {
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAssignedVet = consultation.vetId === requestingUser.sub;
    const isFarmer = consultation.farmerId === requestingUser.sub;

    if (!isSuperOrAdmin && !isAssignedVet && !isFarmer) {
      const membership = await this.prisma.farmMember.findUnique({
        where: {
          farmId_userId: {
            farmId: consultation.farmId,
            userId: requestingUser.sub,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenOperationException(
          "You do not have permission to access the chat for this consultation.",
        );
      }
    }
  }
}
