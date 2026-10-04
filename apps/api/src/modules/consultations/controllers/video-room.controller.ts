import {
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
  EndVideoRoomDto,
  JoinVideoRoomDto,
  JwtPayload,
  UserRole,
  VideoRoomDto,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  IVideoRoomService,
  VIDEO_ROOM_SERVICE,
} from "../services/video-room.service.interface";

@ApiTags("Tele-Veterinary - WebRTC Video Room")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class VideoRoomController {
  constructor(
    @Inject(VIDEO_ROOM_SERVICE)
    private readonly videoRoomService: IVideoRoomService,
  ) {}

  @Post(":id/video-room/provision")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Provision or retrieve 1-on-1 WebRTC video room for consultation",
    description:
      "Provisions a private, strict 2-participant SFU video room (Daily.co) gated by payment authorization for LIVE_VIDEO consultations.",
  })
  @ApiOkResponse({
    description: "Video room provisioned successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Insufficient permissions to provision video room for this consultation",
  })
  @ResponseMessage("Video room provisioned successfully")
  public async provisionVideoRoom(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<VideoRoomDto> {
    return this.videoRoomService.provisionVideoRoom(
      id,
      user,
      `user-${user.sub}`,
    );
  }

  @Post(":id/video-room/join")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Generate ephemeral security token to join 1-on-1 video consultation room",
    description:
      "Generates a time-limited (2h TTL) meeting token granting role-based room privileges (doctor ownership for attending vets, client privileges for farmers).",
  })
  @ApiOkResponse({
    description: "Meeting token generated successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to join this video room",
  })
  @ResponseMessage("Meeting token generated successfully")
  public async joinVideoRoom(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinVideoRoomDto> {
    return this.videoRoomService.joinVideoRoom(
      id,
      user,
      `user-${user.sub}`,
    );
  }

  @Post(":id/video-room/end")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Conclude video consultation session and teardown WebRTC room",
    description:
      "Deletes the SFU video room and transitions the consultation to COMPLETED. Restricted to attending veterinarians and clinic administrators.",
  })
  @ApiOkResponse({
    description: "Video consultation session concluded successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Only attending veterinarians or administrators can end the session",
  })
  @ResponseMessage("Video consultation session concluded successfully")
  public async endVideoRoom(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EndVideoRoomDto> {
    return this.videoRoomService.endVideoRoom(
      id,
      user,
      `user-${user.sub}`,
    );
  }
}
