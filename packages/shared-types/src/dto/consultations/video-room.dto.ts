export interface VideoRoomDto {
  consultationId: string;
  roomName: string;
  roomUrl: string;
  maxParticipants: number;
  privacy: "private" | "public";
  createdAt: string;
  expiresAt: string;
}

export interface JoinVideoRoomDto {
  consultationId: string;
  roomName: string;
  roomUrl: string;
  token: string;
  isOwner: boolean;
  userName: string;
  expiresAt: string;
}

export interface EndVideoRoomDto {
  consultationId: string;
  roomName: string;
  endedAt: string;
  durationMinutes?: number;
}
