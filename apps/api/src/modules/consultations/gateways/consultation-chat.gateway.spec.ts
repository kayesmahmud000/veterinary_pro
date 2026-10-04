import { JwtService } from "@nestjs/jwt";
import {
  ConsultationMessageType,
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IConsultationChatService } from "../services/consultation-chat.service.interface";
import { ConsultationChatGateway } from "./consultation-chat.gateway";

describe("ConsultationChatGateway", () => {
  let gateway: ConsultationChatGateway;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockChatService: jest.Mocked<IConsultationChatService>;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockPrisma: any;

  const mockUser: JwtPayload = {
    sub: "user-1",
    email: "vet@test.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const createMockSocket = (overrides?: Partial<any>) => {
    const socket: any = {
      id: "socket-123",
      handshake: {
        auth: { token: "Bearer valid-token" },
        headers: {},
        query: {},
      },
      data: { user: mockUser },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      disconnect: jest.fn(),
      ...overrides,
    };
    return socket;
  };

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn().mockResolvedValue(mockUser),
    } as unknown as jest.Mocked<JwtService>;

    mockChatService = {
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      generateMediaUploadUrl: jest.fn(),
      markMessagesRead: jest.fn(),
    };

    mockConsultationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockPrisma = {
      farmMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    gateway = new ConsultationChatGateway(
      mockJwtService,
      mockChatService,
      mockConsultationRepo,
      mockPrisma as PrismaService,
    );

    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;
  });

  describe("handleConnection", () => {
    it("should authenticate client with valid token and store user in client.data", async () => {
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
      expect(socket.data.user).toEqual(mockUser);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it("should reject and disconnect client if no token provided", async () => {
      const socket = createMockSocket({
        handshake: { auth: {}, headers: {}, query: {} },
      });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith("error", {
        message: "Unauthorized: Missing authentication token",
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it("should reject and disconnect client if token verification fails", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error("Token expired"));
      const socket = createMockSocket();

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith("error", {
        message: "Unauthorized: Invalid or expired token",
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe("handleJoinRoom", () => {
    it("should join room and broadcast user_joined if user is authorized", async () => {
      const socket = createMockSocket();
      const consult = ConsultationEntity.fromPersistence({
        id: "consult-1",
        farmerId: "farmer-1",
        vetId: "user-1", // matching vet
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Checkup",
        mediaUrls: [],
        type: ConsultationType.LIVE_VIDEO,
        status: ConsultationStatus.IN_PROGRESS,
        roomSessionId: "room-1",
        feeCents: 3000,
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_1",
        paymentHeldAt: new Date(),
        paymentCapturedAt: null,
        paymentReleasedAt: null,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await gateway.handleJoinRoom(socket, { consultationId: "consult-1" });

      expect(socket.join).toHaveBeenCalledWith("consultation:consult-1");
      expect(gateway.server.to).toHaveBeenCalledWith("consultation:consult-1");
    });

    it("should emit error if user is not authorized for consultation", async () => {
      const socket = createMockSocket({
        data: { user: { ...mockUser, sub: "stranger-1" } },
      });
      const consult = ConsultationEntity.fromPersistence({
        id: "consult-1",
        farmerId: "farmer-1",
        vetId: "vet-1",
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Checkup",
        mediaUrls: [],
        type: ConsultationType.LIVE_VIDEO,
        status: ConsultationStatus.IN_PROGRESS,
        roomSessionId: "room-1",
        feeCents: 3000,
        paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
        paymentIntentId: "pi_1",
        paymentHeldAt: new Date(),
        paymentCapturedAt: null,
        paymentReleasedAt: null,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await gateway.handleJoinRoom(socket, { consultationId: "consult-1" });

      expect(socket.emit).toHaveBeenCalledWith("error", {
        message: "Forbidden: Not a participant in this consultation",
      });
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe("handleSendMessage", () => {
    it("should invoke chatService.sendMessage and broadcast new_message to room", async () => {
      const socket = createMockSocket();
      const mockMessage = {
        id: "msg-1",
        consultationId: "consult-1",
        senderId: "user-1",
        senderName: "Dr. Vet",
        senderRole: UserRole.VET,
        content: "Please check temperature.",
        mediaUrls: [],
        messageType: ConsultationMessageType.TEXT,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      mockChatService.sendMessage.mockResolvedValue(mockMessage);

      await gateway.handleSendMessage(socket, {
        consultationId: "consult-1",
        content: "Please check temperature.",
      });

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "consult-1",
        mockUser,
        {
          content: "Please check temperature.",
          mediaUrls: undefined,
          messageType: undefined,
        },
      );
      expect(gateway.server.to).toHaveBeenCalledWith("consultation:consult-1");
    });
  });

  describe("handleTyping", () => {
    it("should broadcast user_typing to other sockets in room", () => {
      const socket = createMockSocket();

      gateway.handleTyping(socket, {
        consultationId: "consult-1",
        isTyping: true,
      });

      expect(socket.to).toHaveBeenCalledWith("consultation:consult-1");
    });
  });

  describe("handleMarkAsRead", () => {
    it("should invoke chatService.markMessagesRead and broadcast messages_read to room", async () => {
      const socket = createMockSocket();
      mockChatService.markMessagesRead.mockResolvedValue({ updatedCount: 2 });

      await gateway.handleMarkAsRead(socket, {
        consultationId: "consult-1",
        messageIds: ["msg-1", "msg-2"],
      });

      expect(mockChatService.markMessagesRead).toHaveBeenCalledWith(
        "consult-1",
        mockUser,
        { messageIds: ["msg-1", "msg-2"] },
      );
      expect(gateway.server.to).toHaveBeenCalledWith("consultation:consult-1");
    });
  });
});
