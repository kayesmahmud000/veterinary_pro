import { Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import {
  ChatMediaAttachment,
  ConsultationMessageDto,
  ConsultationMessageType,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  CONSULTATION_CHAT_SERVICE,
  IConsultationChatService,
} from "../services/consultation-chat.service.interface";

@WebSocketGateway({
  namespace: "/consultations",
  cors: {
    origin: "*",
    credentials: true,
  },
})
@Injectable()
export class ConsultationChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConsultationChatGateway.name);

  @WebSocketServer()
  public server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(CONSULTATION_CHAT_SERVICE)
    private readonly chatService: IConsultationChatService,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(
          `WebSocket connection rejected: No auth token provided (${client.id})`,
        );
        client.emit("error", {
          message: "Unauthorized: Missing authentication token",
        });
        client.disconnect(true);
        return;
      }

      const payload: JwtPayload = await this.jwtService.verifyAsync(token);
      client.data.user = payload;
      this.logger.log(
        `WebSocket client connected: ${client.id} (user: ${payload.sub}, role: ${payload.role})`,
      );
    } catch (err) {
      this.logger.warn(
        `WebSocket connection rejected: Invalid token (${client.id}): ${(err as Error).message}`,
      );
      client.emit("error", {
        message: "Unauthorized: Invalid or expired token",
      });
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: Socket): void {
    const user = client.data?.user as JwtPayload | undefined;
    this.logger.log(
      `WebSocket client disconnected: ${client.id}${user ? ` (user: ${user.sub})` : ""}`,
    );
  }

  @SubscribeMessage("join_room")
  public async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ): Promise<void> {
    const user = client.data?.user as JwtPayload | undefined;
    if (!user) {
      client.emit("error", { message: "Unauthorized" });
      return;
    }

    const isAuthorized = await this.validateConsultationAccess(
      payload.consultationId,
      user,
    );
    if (!isAuthorized) {
      client.emit("error", {
        message: "Forbidden: Not a participant in this consultation",
      });
      return;
    }

    const roomName = `consultation:${payload.consultationId}`;
    await client.join(roomName);

    this.server.to(roomName).emit("user_joined", {
      userId: user.sub,
      role: user.role,
    });

    this.logger.log(
      `User '${user.sub}' joined chat room '${roomName}' via socket '${client.id}'`,
    );
  }

  @SubscribeMessage("leave_room")
  public async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ): Promise<void> {
    const user = client.data?.user as JwtPayload | undefined;
    const roomName = `consultation:${payload.consultationId}`;

    await client.leave(roomName);

    if (user) {
      this.server.to(roomName).emit("user_left", {
        userId: user.sub,
      });
      this.logger.log(
        `User '${user.sub}' left chat room '${roomName}' via socket '${client.id}'`,
      );
    }
  }

  @SubscribeMessage("send_message")
  public async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      consultationId: string;
      content: string;
      mediaUrls?: ChatMediaAttachment[];
      messageType?: ConsultationMessageType;
    },
  ): Promise<void> {
    const user = client.data?.user as JwtPayload | undefined;
    if (!user) {
      client.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const message = await this.chatService.sendMessage(
        payload.consultationId,
        user,
        {
          content: payload.content,
          mediaUrls: payload.mediaUrls,
          messageType: payload.messageType,
        },
      );

      const roomName = `consultation:${payload.consultationId}`;
      this.server.to(roomName).emit("new_message", message);
    } catch (err) {
      client.emit("error", {
        message: (err as Error).message || "Failed to send message",
      });
    }
  }

  @SubscribeMessage("typing_indicator")
  public handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; isTyping: boolean },
  ): void {
    const user = client.data?.user as JwtPayload | undefined;
    if (!user) return;

    const roomName = `consultation:${payload.consultationId}`;
    client.to(roomName).emit("user_typing", {
      userId: user.sub,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage("mark_as_read")
  public async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; messageIds: string[] },
  ): Promise<void> {
    const user = client.data?.user as JwtPayload | undefined;
    if (!user) {
      client.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      await this.chatService.markMessagesRead(payload.consultationId, user, {
        messageIds: payload.messageIds,
      });

      const roomName = `consultation:${payload.consultationId}`;
      this.server.to(roomName).emit("messages_read", {
        userId: user.sub,
        readAt: new Date().toISOString(),
        messageIds: payload.messageIds,
      });
    } catch (err) {
      client.emit("error", {
        message: (err as Error).message || "Failed to mark messages as read",
      });
    }
  }

  public broadcastMessage(
    consultationId: string,
    message: ConsultationMessageDto,
  ): void {
    if (this.server) {
      this.server
        .to(`consultation:${consultationId}`)
        .emit("new_message", message);
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization ||
      client.handshake.query?.token;

    if (!authHeader || typeof authHeader !== "string") {
      return null;
    }

    if (authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }

    return authHeader.trim();
  }

  private async validateConsultationAccess(
    consultationId: string,
    user: JwtPayload,
  ): Promise<boolean> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      return false;
    }

    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN ||
      consultation.vetId === user.sub ||
      consultation.farmerId === user.sub
    ) {
      return true;
    }

    const membership = await this.prisma.farmMember.findUnique({
      where: {
        farmId_userId: {
          farmId: consultation.farmId,
          userId: user.sub,
        },
      },
    });

    return !!membership;
  }
}
