export interface CreateRoomParams {
  name: string;
  privacy?: "private" | "public";
  properties?: {
    maxParticipants?: number;
    exp?: number; // Unix timestamp in seconds
    enableChat?: boolean;
    enableScreenshare?: boolean;
    ejectAtRoomExp?: boolean;
  };
}

export interface VideoRoomResult {
  id: string;
  name: string;
  url: string;
  privacy: "private" | "public";
  createdAt: string;
  expiresAt: string;
  maxParticipants: number;
}

export interface CreateMeetingTokenParams {
  roomName: string;
  userId: string;
  userName: string;
  isOwner?: boolean;
  exp?: number; // Unix timestamp in seconds
  enableScreenshare?: boolean;
}

export interface MeetingTokenResult {
  token: string;
  roomName: string;
  expiresAt: string;
}

export const VIDEO_ROOM_PROVIDER = Symbol("VIDEO_ROOM_PROVIDER");

export interface IVideoRoomProvider {
  createRoom(params: CreateRoomParams): Promise<VideoRoomResult>;
  createMeetingToken(
    params: CreateMeetingTokenParams,
  ): Promise<MeetingTokenResult>;
  getRoom(roomName: string): Promise<VideoRoomResult | null>;
  deleteRoom(roomName: string): Promise<void>;
}
