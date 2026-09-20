import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ChatMediaUploadResponseDto,
  ChatMediaUploadUrlDto,
  ConsultationMessageDto,
  CreateConsultationMessageDto,
  JwtPayload,
  MarkMessagesReadDto,
  QueryConsultationMessagesDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import { ConsultationChatGateway } from "../gateways/consultation-chat.gateway";
import {
  CONSULTATION_CHAT_SERVICE,
  IConsultationChatService,
} from "../services/consultation-chat.service.interface";

@ApiTags("Tele-Veterinary - Consultation Chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class ConsultationChatController {
  constructor(
    @Inject(CONSULTATION_CHAT_SERVICE)
    private readonly chatService: IConsultationChatService,
    private readonly chatGateway: ConsultationChatGateway,
  ) {}

  @Get(":id/messages")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Retrieve paginated consultation chat messages",
    description:
      "Fetches chronological chat history with optional pagination and time-based cursor filtering for a consultation.",
  })
  @ApiOkResponse({
    description: "Consultation messages retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view messages for this consultation",
  })
  @ResponseMessage("Consultation messages retrieved successfully")
  public async getMessages(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryConsultationMessagesDto,
  ): Promise<{
    items: ConsultationMessageDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.chatService.getMessages(id, user, query);
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Send a message in a consultation (HTTP fallback)",
    description:
      "Persists a text or media message to the consultation chat history and broadcasts it to all active WebSocket clients.",
  })
  @ApiOkResponse({
    description: "Message sent and broadcast successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to send messages for this consultation",
  })
  @ResponseMessage("Message sent successfully")
  public async sendMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConsultationMessageDto,
  ): Promise<ConsultationMessageDto> {
    const message = await this.chatService.sendMessage(
      id,
      user,
      dto,
      `user-${user.sub}`,
    );

    // Broadcast to WebSocket clients
    this.chatGateway.broadcastMessage(id, message);

    return message;
  }

  @Post(":id/messages/media-upload-url")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Generate presigned S3 upload URL for chat media attachment",
    description:
      "Generates a short-lived (15 min) presigned S3 PUT URL for uploading clinical images, videos, audio, or PDFs to attach to chat.",
  })
  @ApiOkResponse({
    description: "Presigned upload URL generated successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to upload media for this consultation",
  })
  @ResponseMessage("Presigned upload URL generated successfully")
  public async generateMediaUploadUrl(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChatMediaUploadUrlDto,
  ): Promise<ChatMediaUploadResponseDto> {
    return this.chatService.generateMediaUploadUrl(id, user, dto);
  }

  @Patch(":id/messages/read")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Mark consultation chat messages as read",
    description:
      "Updates the read status of specified messages in the consultation.",
  })
  @ApiOkResponse({
    description: "Messages marked as read successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to update messages for this consultation",
  })
  @ResponseMessage("Messages marked as read successfully")
  public async markMessagesRead(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MarkMessagesReadDto,
  ): Promise<{ updatedCount: number }> {
    return this.chatService.markMessagesRead(id, user, dto);
  }
}
