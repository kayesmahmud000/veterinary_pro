import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "../../../config/env.service";
import { MockVideoRoomProvider } from "./mock-video-room.provider";
import {
  CreateMeetingTokenParams,
  CreateRoomParams,
  IVideoRoomProvider,
  MeetingTokenResult,
  VideoRoomResult,
} from "./video-room-provider.interface";

@Injectable()
export class DailyVideoRoomProvider implements IVideoRoomProvider {
  private readonly logger = new Logger(DailyVideoRoomProvider.name);
  private readonly mockProvider = new MockVideoRoomProvider();
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.daily.co/v1";

  constructor(private readonly envService: EnvService) {
    this.apiKey = this.envService.dailyApiKey;
    if (!this.apiKey) {
      this.logger.warn(
        "DAILY_API_KEY is not configured. Falling back to mock video room provider mode.",
      );
    }
  }

  public async createRoom(params: CreateRoomParams): Promise<VideoRoomResult> {
    if (!this.apiKey) {
      return this.mockProvider.createRoom(params);
    }

    try {
      const response = await fetch(`${this.baseUrl}/rooms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.name,
          privacy: params.privacy ?? "private",
          properties: {
            max_participants: params.properties?.maxParticipants ?? 2,
            exp: params.properties?.exp,
            enable_chat: params.properties?.enableChat ?? true,
            enable_screenshare: params.properties?.enableScreenshare ?? true,
            eject_at_room_exp: params.properties?.ejectAtRoomExp ?? true,
          },
        }),
      });

      if (!response.ok) {
        // If room already exists, fetch it
        if (response.status === 400) {
          const existing = await this.getRoom(params.name);
          if (existing) {
            return existing;
          }
        }
        const errText = await response.text();
        throw new Error(`Daily.co createRoom error [${response.status}]: ${errText}`);
      }

      const data = (await response.json()) as any;
      const now = new Date();
      const expiresAt = data.config?.exp
        ? new Date(data.config.exp * 1000).toISOString()
        : new Date(now.getTime() + 7200000).toISOString();

      return {
        id: data.id ?? `daily-${data.name}`,
        name: data.name,
        url: data.url,
        privacy: data.privacy ?? "private",
        createdAt: data.created_at ?? now.toISOString(),
        expiresAt,
        maxParticipants: data.config?.max_participants ?? 2,
      };
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create Daily.co room '${params.name}': ${err instanceof Error ? err.message : String(err)}. Falling back to mock provider.`,
      );
      return this.mockProvider.createRoom(params);
    }
  }

  public async createMeetingToken(
    params: CreateMeetingTokenParams,
  ): Promise<MeetingTokenResult> {
    if (!this.apiKey) {
      return this.mockProvider.createMeetingToken(params);
    }

    try {
      const response = await fetch(`${this.baseUrl}/meeting-tokens`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            room_name: params.roomName,
            user_id: params.userId,
            user_name: params.userName,
            is_owner: params.isOwner ?? false,
            exp: params.exp,
            enable_screenshare: params.enableScreenshare ?? true,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Daily.co createMeetingToken error [${response.status}]: ${errText}`,
        );
      }

      const data = (await response.json()) as any;
      const expSeconds =
        params.exp ?? Math.floor(Date.now() / 1000) + 7200;
      const expiresAt = new Date(expSeconds * 1000).toISOString();

      return {
        token: data.token,
        roomName: params.roomName,
        expiresAt,
      };
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create Daily.co meeting token for room '${params.roomName}': ${err instanceof Error ? err.message : String(err)}. Falling back to mock provider.`,
      );
      return this.mockProvider.createMeetingToken(params);
    }
  }

  public async getRoom(roomName: string): Promise<VideoRoomResult | null> {
    if (!this.apiKey) {
      return this.mockProvider.getRoom(roomName);
    }

    try {
      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Daily.co getRoom error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const now = new Date();
      const expiresAt = data.config?.exp
        ? new Date(data.config.exp * 1000).toISOString()
        : new Date(now.getTime() + 7200000).toISOString();

      return {
        id: data.id ?? `daily-${data.name}`,
        name: data.name,
        url: data.url,
        privacy: data.privacy ?? "private",
        createdAt: data.created_at ?? now.toISOString(),
        expiresAt,
        maxParticipants: data.config?.max_participants ?? 2,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to fetch Daily.co room '${roomName}': ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.mockProvider.getRoom(roomName);
    }
  }

  public async deleteRoom(roomName: string): Promise<void> {
    if (!this.apiKey) {
      return this.mockProvider.deleteRoom(roomName);
    }

    try {
      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        this.logger.warn(`Daily.co deleteRoom returned ${response.status}`);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to delete Daily.co room '${roomName}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
