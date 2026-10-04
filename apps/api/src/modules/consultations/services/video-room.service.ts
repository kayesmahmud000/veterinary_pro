import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConsultationStatus,
  ConsultationType,
  EndVideoRoomDto,
  JoinVideoRoomDto,
  JwtPayload,
  UserRole,
  VideoRoomDto,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import {
  IVideoRoomProvider,
  VIDEO_ROOM_PROVIDER,
} from "../providers/video-room-provider.interface";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import { IVideoRoomService } from "./video-room.service.interface";

@Injectable()
export class VideoRoomService implements IVideoRoomService {
  private readonly logger = new Logger(VideoRoomService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VIDEO_ROOM_PROVIDER)
    private readonly videoRoomProvider: IVideoRoomProvider,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async provisionVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<VideoRoomDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (consultation.type !== ConsultationType.LIVE_VIDEO) {
      throw new ValidationDomainException(
        "Video rooms can only be provisioned for LIVE_VIDEO consultations.",
      );
    }

    if (
      consultation.status !== ConsultationStatus.ASSIGNED &&
      consultation.status !== ConsultationStatus.IN_PROGRESS
    ) {
      throw new ValidationDomainException(
        `Cannot provision video room for consultation in status '${consultation.status}'. Consultation must be ASSIGNED or IN_PROGRESS.`,
      );
    }

    if (consultation.feeCents > 0 && !consultation.isPaymentAuthorized()) {
      throw new ValidationDomainException(
        "Payment authorization hold required before video room can be provisioned.",
      );
    }

    await this.verifyUserAccess(consultation, requestingUser);

    const roomName =
      consultation.roomSessionId ?? `vetralink-consult-${consultationId}`;

    let room = await this.videoRoomProvider.getRoom(roomName);
    if (!room) {
      const now = new Date();
      const expSeconds = Math.floor(now.getTime() / 1000) + 7200; // 2 hours

      room = await this.videoRoomProvider.createRoom({
        name: roomName,
        privacy: "private",
        properties: {
          maxParticipants: 2,
          exp: expSeconds,
          enableChat: true,
          enableScreenshare: true,
          ejectAtRoomExp: true,
        },
      });

      if (!consultation.roomSessionId) {
        consultation.setRoomSessionId(room.name);
        if (consultation.status === ConsultationStatus.ASSIGNED) {
          consultation.startConsultation(room.name);
        }
        await this.consultationRepo.save(consultation);
      }

      await this.auditLogRepo.record({
        userId: requestingUser.sub,
        action: "CONSULTATION_ROOM_PROVISIONED",
        entityType: "Consultation",
        entityId: consultationId,
        newValues: {
          roomName: room.name,
          roomUrl: room.url,
          maxParticipants: room.maxParticipants,
        },
        traceId: traceId ?? crypto.randomUUID(),
      });

      this.logger.log(
        `Provisioned video room '${room.name}' for consultation '${consultationId}' by user '${requestingUser.sub}'`,
      );
    }

    return {
      consultationId,
      roomName: room.name,
      roomUrl: room.url,
      maxParticipants: room.maxParticipants,
      privacy: room.privacy,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
    };
  }

  public async joinVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<JoinVideoRoomDto> {
    const roomDto = await this.provisionVideoRoom(
      consultationId,
      requestingUser,
      traceId,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const isOwner =
      requestingUser.sub === consultation.vetId ||
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;

    const user = await this.prisma.user.findUnique({
      where: { id: requestingUser.sub },
      select: { name: true },
    });

    const userName =
      user?.name ??
      (isOwner ? "Attending Veterinarian" : "Client Farmer");

    const tokenResult = await this.videoRoomProvider.createMeetingToken({
      roomName: roomDto.roomName,
      userId: requestingUser.sub,
      userName,
      isOwner,
      exp: Math.floor(Date.now() / 1000) + 7200,
    });

    await this.auditLogRepo.record({
      userId: requestingUser.sub,
      action: "CONSULTATION_ROOM_JOINED",
      entityType: "Consultation",
      entityId: consultationId,
      newValues: {
        roomName: roomDto.roomName,
        isOwner,
        userName,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `User '${requestingUser.sub}' (${userName}, owner: ${isOwner}) joined video room '${roomDto.roomName}' for consultation '${consultationId}'`,
    );

    return {
      consultationId,
      roomName: roomDto.roomName,
      roomUrl: roomDto.roomUrl,
      token: tokenResult.token,
      isOwner,
      userName,
      expiresAt: tokenResult.expiresAt,
    };
  }

  public async endVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<EndVideoRoomDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    const isVetOrAdmin =
      requestingUser.sub === consultation.vetId ||
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;

    if (!isVetOrAdmin) {
      throw new ForbiddenOperationException(
        "Only the attending veterinarian or an administrator can conclude the video consultation session.",
      );
    }

    const roomName =
      consultation.roomSessionId ?? `vetralink-consult-${consultationId}`;

    await this.videoRoomProvider.deleteRoom(roomName);

    const now = new Date();
    if (
      consultation.status === ConsultationStatus.IN_PROGRESS ||
      consultation.status === ConsultationStatus.ASSIGNED
    ) {
      consultation.complete(now);
      await this.consultationRepo.save(consultation);
    }

    await this.auditLogRepo.record({
      userId: requestingUser.sub,
      action: "CONSULTATION_ROOM_TERMINATED",
      entityType: "Consultation",
      entityId: consultationId,
      newValues: {
        roomName,
        endedAt: now.toISOString(),
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Video room '${roomName}' concluded for consultation '${consultationId}' by user '${requestingUser.sub}'`,
    );

    return {
      consultationId,
      roomName,
      endedAt: now.toISOString(),
    };
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
          "You do not have permission to access the video room for this consultation.",
        );
      }
    }
  }
}
