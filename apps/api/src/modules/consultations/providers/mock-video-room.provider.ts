import { Injectable, Logger } from "@nestjs/common";
import {
  CreateMeetingTokenParams,
  CreateRoomParams,
  IVideoRoomProvider,
  MeetingTokenResult,
  VideoRoomResult,
} from "./video-room-provider.interface";

@Injectable()
export class MockVideoRoomProvider implements IVideoRoomProvider {
  private readonly logger = new Logger(MockVideoRoomProvider.name);
  private readonly rooms = new Map<string, VideoRoomResult>();
  private readonly tokens = new Map<string, MeetingTokenResult>();

  public shouldFail = false;
  public failureMessage = "Simulated WebRTC Gateway Error";

  public async createRoom(params: CreateRoomParams): Promise<VideoRoomResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const existing = this.rooms.get(params.name);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const expSeconds =
      params.properties?.exp ?? Math.floor(now.getTime() / 1000) + 7200; // 2 hours default
    const expiresAt = new Date(expSeconds * 1000).toISOString();

    const room: VideoRoomResult = {
      id: `mock-room-${crypto.randomUUID()}`,
      name: params.name,
      url: `https://vetralink.daily.co/${params.name}`,
      privacy: params.privacy ?? "private",
      createdAt: now.toISOString(),
      expiresAt,
      maxParticipants: params.properties?.maxParticipants ?? 2,
    };

    this.rooms.set(params.name, room);
    this.logger.log(
      `[MockWebRTC] Created video room '${room.name}' (max: ${room.maxParticipants})`,
    );

    return room;
  }

  public async createMeetingToken(
    params: CreateMeetingTokenParams,
  ): Promise<MeetingTokenResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const now = new Date();
    const expSeconds =
      params.exp ?? Math.floor(now.getTime() / 1000) + 7200; // 2 hours
    const expiresAt = new Date(expSeconds * 1000).toISOString();

    const token = `mock-token-${params.isOwner ? "owner" : "client"}-${crypto.randomUUID()}`;
    const result: MeetingTokenResult = {
      token,
      roomName: params.roomName,
      expiresAt,
    };

    this.tokens.set(token, result);
    this.logger.log(
      `[MockWebRTC] Generated meeting token for room '${params.roomName}' (user: ${params.userName}, owner: ${params.isOwner ?? false})`,
    );

    return result;
  }

  public async getRoom(roomName: string): Promise<VideoRoomResult | null> {
    return this.rooms.get(roomName) ?? null;
  }

  public async deleteRoom(roomName: string): Promise<void> {
    this.rooms.delete(roomName);
    this.logger.log(`[MockWebRTC] Deleted video room '${roomName}'`);
  }

  public clear(): void {
    this.rooms.clear();
    this.tokens.clear();
    this.shouldFail = false;
  }
}
