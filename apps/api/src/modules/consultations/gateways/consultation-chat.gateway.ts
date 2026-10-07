import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
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
import { z } from "zod";
import {
  TOKEN_SERVICE,
  ITokenService,
} from "../../auth/services/token.service.interface";
import { CurrentIdentityService } from "../../auth/services/current-identity.service";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../../farms/repositories/farm-member.repository.interface";
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
  cors: { origin: "*", credentials: true },
})
@Injectable()
export class ConsultationChatGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer() public server!: Server;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    @Inject(CONSULTATION_CHAT_SERVICE)
    private readonly chat: IConsultationChatService,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultations: IConsultationRepository,
    @Inject(FARM_MEMBER_REPOSITORY)
    private readonly members: IFarmMemberRepository,
    private readonly identities: CurrentIdentityService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expireSessions();
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private allowed(user: JwtPayload) {
    return (
      [
        UserRole.FARMER,
        UserRole.VET,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
      ].includes(user.role) &&
      !(user.role === UserRole.FARMER && user.farmerOnboardingRequired)
    );
  }
  private async current(client: any): Promise<JwtPayload | null> {
    try {
      if (!client.data?.user) throw new Error("Missing session");
      const user = await this.identities.resolve(client.data.user);
      if (!this.allowed(user)) throw new Error("Forbidden");
      client.data.user = user;
      return user;
    } catch {
      client.emit("error", {
        code: "AUTHORIZATION_CHANGED",
        message: "Session changed. Reconnect after signing in.",
      });
      client.disconnect(true);
      return null;
    }
  }
  async handleConnection(client: Socket): Promise<void> {
    try {
      const header =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (typeof header !== "string" || !header)
        throw new Error("Missing token");
      client.data.user = await this.tokens.verifyAccessToken(
        header.replace(/^Bearer\s+/i, "").trim(),
      );
      await this.current(client);
    } catch {
      client.emit("error", {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token.",
      });
      client.disconnect(true);
    }
  }
  handleDisconnect(_client: Socket): void {}
  private async access(id: string, user: JwtPayload): Promise<boolean> {
    if (!z.string().uuid().safeParse(id).success || !this.allowed(user))
      return false;
    const consultation = await this.consultations.findById(id);
    if (!consultation) return false;
    if (
      [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) ||
      consultation.vetId === user.sub ||
      consultation.farmerId === user.sub
    )
      return true;
    return !!(await this.members.findMembership(consultation.farmId, user.sub));
  }
  private async participant(
    client: Socket,
    id: string,
  ): Promise<JwtPayload | null> {
    const user = await this.current(client);
    if (!user) return null;
    if (!(await this.access(id, user))) {
      client.emit("error", {
        code: "FORBIDDEN",
        message: "Not a consultation participant.",
      });
      return null;
    }
    return user;
  }
  // Check every recipient against the primary database before emitting, including passive sockets.
  // This also works across Socket.IO adapters and does not depend on a Redis invalidation event arriving.
  private async emit(
    id: string,
    event: string,
    payload: unknown,
    excludeId?: string,
  ): Promise<void> {
    if (!this.server) return;
    for (const client of await this.server
      .in(`consultation:${id}`)
      .fetchSockets()) {
      if (client.id === excludeId) continue;
      const user = await this.current(client);
      if (user && (await this.access(id, user))) client.emit(event, payload);
      else if (user) await client.leave(`consultation:${id}`);
    }
  }
  private async expireSessions() {
    if (!this.server) return;
    try {
      for (const client of await this.server.fetchSockets())
        await this.current(client);
    } catch {
      /* A later emission still fails closed. */
    }
  }
  @SubscribeMessage("join_room") async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ) {
    const user = await this.participant(client, payload?.consultationId);
    if (!user) return;
    await client.join(`consultation:${payload.consultationId}`);
    await this.emit(payload.consultationId, "user_joined", {
      userId: user.sub,
      role: user.role,
    });
  }
  @SubscribeMessage("leave_room") async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string },
  ) {
    const user = await this.current(client);
    if (!user || !z.string().uuid().safeParse(payload?.consultationId).success)
      return;
    await client.leave(`consultation:${payload.consultationId}`);
    await this.emit(payload.consultationId, "user_left", { userId: user.sub });
  }
  @SubscribeMessage("send_message") async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      consultationId: string;
      content: string;
      mediaUrls?: ChatMediaAttachment[];
      messageType?: ConsultationMessageType;
    },
  ) {
    const user = await this.participant(client, payload?.consultationId);
    if (!user) return;
    try {
      const message = await this.chat.sendMessage(
        payload.consultationId,
        user,
        {
          content: payload.content,
          mediaUrls: payload.mediaUrls,
          messageType: payload.messageType,
        },
      );
      await this.emit(payload.consultationId, "new_message", message);
    } catch {
      client.emit("error", { message: "Failed to send message." });
    }
  }
  @SubscribeMessage("typing_indicator") async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; isTyping: boolean },
  ) {
    const user = await this.participant(client, payload?.consultationId);
    if (!user || typeof payload.isTyping !== "boolean") return;
    await this.emit(
      payload.consultationId,
      "user_typing",
      { userId: user.sub, isTyping: payload.isTyping },
      client.id,
    );
  }
  @SubscribeMessage("mark_as_read") async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { consultationId: string; messageIds: string[] },
  ) {
    const user = await this.participant(client, payload?.consultationId);
    if (!user) return;
    try {
      await this.chat.markMessagesRead(payload.consultationId, user, {
        messageIds: payload.messageIds,
      });
      await this.emit(payload.consultationId, "messages_read", {
        userId: user.sub,
        readAt: new Date().toISOString(),
        messageIds: payload.messageIds,
      });
    } catch {
      client.emit("error", { message: "Failed to mark messages as read." });
    }
  }
  async broadcastMessage(
    consultationId: string,
    message: ConsultationMessageDto,
  ): Promise<void> {
    await this.emit(consultationId, "new_message", message);
  }
}
