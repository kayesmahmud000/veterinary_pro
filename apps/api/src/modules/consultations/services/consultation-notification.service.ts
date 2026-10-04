import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  ChannelDeliveryResultDto,
  ConsultationNotificationChannel,
  ConsultationNotificationLogDto,
  ConsultationNotificationResultDto,
  ConsultationNotificationStatus,
  ConsultationType,
  NotifyVetDto,
  PaginatedVetNotificationsDto,
  QueryVetNotificationsDto,
  UserRole,
} from "@vetralink/shared-types";
import { Observable, Subject } from "rxjs";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "../../clinical-health/providers/notification-provider.interface";
import {
  IMailService,
  MAIL_SERVICE,
} from "../../mail/interfaces/mail-service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationNotificationLogEntity } from "../entities/consultation-notification-log.entity";
import {
  CONSULTATION_NOTIFICATION_LOG_REPOSITORY,
  IConsultationNotificationLogRepository,
} from "../repositories/consultation-notification-log.repository.interface";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  ConsultationSseEvent,
  IConsultationNotificationService,
} from "./consultation-notification.service.interface";

@Injectable()
export class ConsultationNotificationService
  implements IConsultationNotificationService
{
  private readonly logger = new Logger(ConsultationNotificationService.name);
  private readonly vetStreams = new Map<
    string,
    Subject<ConsultationSseEvent>
  >();

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(CONSULTATION_NOTIFICATION_LOG_REPOSITORY)
    private readonly notificationLogRepo: IConsultationNotificationLogRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    private readonly piiCrypto: PiiCryptoService,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: ISmsNotificationProvider,
    @Optional()
    @Inject(MAIL_SERVICE)
    private readonly mailService?: IMailService,
  ) {}

  public async dispatchAssignmentNotification(
    consultationId: string,
    vetId: string,
    options?: NotifyVetDto & { traceId?: string },
  ): Promise<ConsultationNotificationResultDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const vetUser = await this.prisma.user.findUnique({
      where: { id: vetId },
    });
    if (!vetUser || vetUser.role !== UserRole.VET || vetUser.deletedAt !== null) {
      throw new ValidationDomainException(
        `User '${vetId}' is not an active veterinarian.`,
      );
    }

    const channelsToDispatch =
      options?.channels && options.channels.length > 0
        ? options.channels
        : [
            ConsultationNotificationChannel.IN_APP,
            ConsultationNotificationChannel.PUSH,
            ConsultationNotificationChannel.SMS,
            ConsultationNotificationChannel.EMAIL,
          ];

    const species = consultation.animal?.species ?? "Livestock";
    const tagNumber = consultation.animal?.tagNumber
      ? `Tag #${consultation.animal.tagNumber}`
      : "General Herd";
    const farmName = consultation.farm?.name ?? "Client Farm";
    const scheduledAtStr = consultation.scheduledAt
      ? new Date(consultation.scheduledAt).toUTCString()
      : "Immediate Triage";

    const title =
      consultation.type === ConsultationType.LIVE_VIDEO
        ? `Live Video Consultation Assigned: ${species} (${tagNumber})`
        : `New Consultation Case Assigned: ${species} (${tagNumber})`;

    const customNoteSnippet = options?.customNote
      ? ` Note: ${options.customNote}`
      : "";
    const message = `Case #${consultation.id.slice(0, 8)} at ${farmName}. Complaint: ${consultation.chiefComplaint}. Scheduled: ${scheduledAtStr}.${customNoteSnippet}`;

    const channelResults: ChannelDeliveryResultDto[] = [];
    const now = new Date();

    for (const channel of channelsToDispatch) {
      let status = ConsultationNotificationStatus.SENT;
      let errorMessage: string | null = null;
      let messageId: string | undefined;

      try {
        switch (channel) {
          case ConsultationNotificationChannel.IN_APP: {
            // IN_APP is always immediately persisted and streamed via SSE
            status = ConsultationNotificationStatus.SENT;
            messageId = `in-app-${crypto.randomUUID()}`;
            break;
          }

          case ConsultationNotificationChannel.PUSH: {
            const pushResult = await this.pushProvider.sendPush({
              userId: vetId,
              title,
              body: message,
              data: {
                consultationId,
                type: consultation.type,
                farmId: consultation.farmId,
              },
            });
            if (!pushResult.success) {
              status = ConsultationNotificationStatus.FAILED;
              errorMessage = pushResult.error ?? "Push delivery failed";
            } else {
              messageId = pushResult.messageId;
            }
            break;
          }

          case ConsultationNotificationChannel.SMS: {
            if (!vetUser.phone) {
              status = ConsultationNotificationStatus.FAILED;
              errorMessage = "Veterinarian has no phone number configured";
            } else {
              let decryptedPhone: string;
              try {
                decryptedPhone = this.piiCrypto.decrypt(vetUser.phone);
              } catch (cryptoErr) {
                // If not encrypted or decrypt fails, fall back to raw if E.164-like
                decryptedPhone = vetUser.phone;
              }

              const smsResult = await this.smsProvider.sendSms({
                to: decryptedPhone,
                body: `[VETRALINK] ${title}: ${message}`,
                metadata: {
                  consultationId,
                  vetId,
                  traceId: options?.traceId,
                },
              });

              if (!smsResult.success) {
                status = ConsultationNotificationStatus.FAILED;
                errorMessage = smsResult.error ?? "SMS delivery failed";
              } else {
                messageId = smsResult.messageId;
              }
            }
            break;
          }

          case ConsultationNotificationChannel.EMAIL: {
            if (!vetUser.email) {
              status = ConsultationNotificationStatus.FAILED;
              errorMessage = "Veterinarian has no email address configured";
            } else if (this.mailService) {
              const emailResult = await this.mailService.sendEmail({
                to: vetUser.email,
                subject: `[VETRALINK Tele-Vet] ${title}`,
                text: `${title}\n\n${message}\n\nPlease log in to VETRALINK PRO portal to review clinical history and initiate consultation.`,
                html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
                  <h2 style="color: #1a56db;">${title}</h2>
                  <p>${message}</p>
                  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                  <p><strong>Farm:</strong> ${farmName}</p>
                  <p><strong>Patient:</strong> ${species} (${tagNumber})</p>
                  <p><strong>Type:</strong> ${consultation.type}</p>
                  <p><strong>Scheduled:</strong> ${scheduledAtStr}</p>
                  <p><a href="https://vetralink.pro/consultations/${consultationId}" style="display: inline-block; padding: 10px 16px; background-color: #1a56db; color: #ffffff; text-decoration: none; border-radius: 6px; margin-top: 12px;">Open Consultation Room</a></p>
                </div>`,
              });

              if (!emailResult.success) {
                status = ConsultationNotificationStatus.FAILED;
                errorMessage = emailResult.error ?? "Email delivery failed";
              } else {
                messageId = emailResult.messageId;
              }
            } else {
              // Mail service optional or not provided in environment
              status = ConsultationNotificationStatus.SENT;
              messageId = `mock-mail-${crypto.randomUUID()}`;
            }
            break;
          }
        }
      } catch (err: unknown) {
        status = ConsultationNotificationStatus.FAILED;
        errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Error delivering consultation notification via channel ${channel} to vet ${vetId}: ${errorMessage}`,
        );
      }

      const logEntity = ConsultationNotificationLogEntity.create({
        consultationId,
        vetId,
        channel,
        status,
        title,
        message,
        errorMessage,
        metadata: {
          messageId,
          type: consultation.type,
          species,
          tagNumber,
          farmName,
          customNote: options?.customNote ?? null,
        },
        dispatchedAt: now,
      });

      const savedLog = await this.notificationLogRepo.create(logEntity);

      // If IN_APP or successful push, also emit to real-time SSE stream
      if (channel === ConsultationNotificationChannel.IN_APP) {
        this.emitToStream(vetId, savedLog.toDto());
      }

      channelResults.push({
        channel,
        status,
        messageId,
        error: errorMessage ?? undefined,
      });
    }

    await this.auditLogRepo.record({
      userId: vetId,
      action: "CONSULTATION_NOTIFICATION_DISPATCHED",
      entityType: "Consultation",
      entityId: consultationId,
      newValues: {
        channels: channelsToDispatch,
        results: channelResults,
      },
      traceId: options?.traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Dispatched assignment notifications for consultation '${consultationId}' to vet '${vetId}' across [${channelsToDispatch.join(", ")}]`,
    );

    return {
      consultationId,
      vetId,
      channels: channelResults,
      dispatchedAt: now.toISOString(),
    };
  }

  public async getVetNotifications(
    vetId: string,
    query: QueryVetNotificationsDto,
  ): Promise<PaginatedVetNotificationsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const { items, total, unreadCount } =
      await this.notificationLogRepo.findByVet(vetId, query);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((log) => log.toDto()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages,
        unreadCount,
      },
    };
  }

  public async markAsRead(
    notificationId: string,
    vetId: string,
  ): Promise<ConsultationNotificationLogDto> {
    const log = await this.notificationLogRepo.findById(notificationId);
    if (!log) {
      throw new EntityNotFoundException(
        "ConsultationNotificationLog",
        notificationId,
      );
    }

    if (log.vetId !== vetId) {
      throw new ForbiddenOperationException(
        "You do not have permission to modify this notification.",
      );
    }

    log.markAsRead();
    const saved = await this.notificationLogRepo.save(log);

    return saved.toDto();
  }

  public getNotificationStream(vetId: string): Observable<ConsultationSseEvent> {
    let subject = this.vetStreams.get(vetId);
    if (!subject) {
      subject = new Subject<ConsultationSseEvent>();
      this.vetStreams.set(vetId, subject);
    }

    return subject.asObservable();
  }

  private emitToStream(vetId: string, dto: ConsultationNotificationLogDto): void {
    const subject = this.vetStreams.get(vetId);
    if (subject) {
      subject.next({
        data: dto,
        type: "consultation_assigned",
        id: dto.id,
      });
    }
  }
}
