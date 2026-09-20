import {
  Body,
  Controller,
  Get,
  Inject,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  ConsultationNotificationLogDto,
  ConsultationNotificationResultDto,
  JwtPayload,
  PaginatedVetNotificationsDto,
  UserRole,
} from "@vetralink/shared-types";
import { map, Observable } from "rxjs";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  NotifyVetRequestDto,
  QueryVetNotificationsRequestDto,
} from "../dto";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  CONSULTATION_NOTIFICATION_SERVICE,
  IConsultationNotificationService,
} from "../services/consultation-notification.service.interface";

@ApiTags("Tele-Veterinary - Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class ConsultationNotificationController {
  constructor(
    @Inject(CONSULTATION_NOTIFICATION_SERVICE)
    private readonly notificationService: IConsultationNotificationService,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
  ) {}

  @Post(":id/notify-vet")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Manually trigger or re-send notification dispatch to assigned veterinarian",
    description:
      "Dispatches real-time notification (SSE/In-App, Push, SMS, and/or Email) to the assigned veterinarian with optional custom note.",
  })
  @ApiOkResponse({
    description: "Notification dispatched successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Consultation notification dispatched successfully")
  public async notifyAssignedVet(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: NotifyVetRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationNotificationResultDto> {
    const consultation = await this.consultationRepo.findById(id);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", id);
    }

    if (!consultation.vetId) {
      throw new ValidationDomainException(
        "Cannot dispatch notification to a consultation without an assigned veterinarian.",
      );
    }

    return this.notificationService.dispatchAssignmentNotification(
      id,
      consultation.vetId,
      {
        channels: dto.channels,
        customNote: dto.customNote,
        traceId: `user-${user.sub}`,
      },
    );
  }

  @Get("vets/:vetId/notifications")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Get paginated notification history for a veterinarian",
    description:
      "Retrieves past notifications with channel, delivery status, and read timestamp. Veterinarians can view their own feed; admins can view any.",
  })
  @ApiOkResponse({
    description: "Veterinarian notifications retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view this veterinarian's notifications",
  })
  @ResponseMessage("Veterinarian notifications retrieved successfully")
  public async getVetNotifications(
    @Param("vetId", ParseUUIDPipe) vetId: string,
    @Query() query: QueryVetNotificationsRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedVetNotificationsDto> {
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.sub !== vetId
    ) {
      throw new ForbiddenOperationException(
        "You do not have permission to view notifications for this veterinarian.",
      );
    }

    return this.notificationService.getVetNotifications(vetId, query);
  }

  @Patch("vets/:vetId/notifications/:notificationId/read")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Mark a notification as read",
    description:
      "Marks a specific notification as read, updating its readAt timestamp.",
  })
  @ApiOkResponse({
    description: "Notification marked as read successfully",
  })
  @ApiNotFoundResponse({ description: "Notification not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to modify this notification",
  })
  @ResponseMessage("Notification marked as read successfully")
  public async markAsRead(
    @Param("vetId", ParseUUIDPipe) vetId: string,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationNotificationLogDto> {
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.sub !== vetId
    ) {
      throw new ForbiddenOperationException(
        "You do not have permission to modify this notification.",
      );
    }

    return this.notificationService.markAsRead(notificationId, vetId);
  }

  @Sse("vets/:vetId/notifications/stream")
  @ApiOperation({
    summary: "Subscribe to real-time Server-Sent Events (SSE) notification stream",
    description:
      "Establishes a continuous SSE stream delivering live consultation assignment alerts to the active veterinarian session.",
  })
  public streamVetNotifications(
    @Param("vetId", ParseUUIDPipe) vetId: string,
  ): Observable<MessageEvent> {
    return this.notificationService.getNotificationStream(vetId).pipe(
      map((event) => ({
        data: event.data,
        type: event.type ?? "consultation_notification",
        id: event.id,
      })),
    );
  }
}
