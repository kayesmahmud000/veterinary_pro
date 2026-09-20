import {
  EndVideoRoomDto,
  JoinVideoRoomDto,
  JwtPayload,
  VideoRoomDto,
} from "@vetralink/shared-types";

export const VIDEO_ROOM_SERVICE = Symbol("VIDEO_ROOM_SERVICE");

export interface IVideoRoomService {
  provisionVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<VideoRoomDto>;

  joinVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<JoinVideoRoomDto>;

  endVideoRoom(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<EndVideoRoomDto>;
}
