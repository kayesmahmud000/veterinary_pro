import {
  ConsultationMessageType,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { ConsultationChatGateway } from "../gateways/consultation-chat.gateway";
import { IConsultationChatService } from "../services/consultation-chat.service.interface";
import { ConsultationChatController } from "./consultation-chat.controller";

describe("ConsultationChatController", () => {
  let controller: ConsultationChatController;
  let mockChatService: jest.Mocked<IConsultationChatService>;
  let mockChatGateway: jest.Mocked<ConsultationChatGateway>;

  const mockUser: JwtPayload = {
    sub: "user-123",
    email: "user@test.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    mockChatService = {
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      generateMediaUploadUrl: jest.fn(),
      markMessagesRead: jest.fn(),
    };

    mockChatGateway = {
      broadcastMessage: jest.fn(),
    } as unknown as jest.Mocked<ConsultationChatGateway>;

    controller = new ConsultationChatController(
      mockChatService,
      mockChatGateway,
    );
  });

  describe("getMessages", () => {
    it("should call chatService.getMessages and return paginated list", async () => {
      const mockResult = {
        items: [
          {
            id: "msg-1",
            consultationId: "c-123",
            senderId: "user-123",
            senderName: "Farmer",
            senderRole: UserRole.FARMER,
            content: "Hello",
            mediaUrls: [],
            messageType: ConsultationMessageType.TEXT,
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      };
      mockChatService.getMessages.mockResolvedValue(mockResult);

      const result = await controller.getMessages("c-123", mockUser, {
        page: 1,
        limit: 50,
      });

      expect(result).toEqual(mockResult);
      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        "c-123",
        mockUser,
        { page: 1, limit: 50 },
      );
    });
  });

  describe("sendMessage", () => {
    it("should call chatService.sendMessage, broadcast to gateway, and return message", async () => {
      const mockMessage = {
        id: "msg-1",
        consultationId: "c-123",
        senderId: "user-123",
        senderName: "Farmer",
        senderRole: UserRole.FARMER,
        content: "What is dosage?",
        mediaUrls: [],
        messageType: ConsultationMessageType.TEXT,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      mockChatService.sendMessage.mockResolvedValue(mockMessage);

      const result = await controller.sendMessage("c-123", mockUser, {
        content: "What is dosage?",
      });

      expect(result).toEqual(mockMessage);
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "c-123",
        mockUser,
        { content: "What is dosage?" },
        "user-user-123",
      );
      expect(mockChatGateway.broadcastMessage).toHaveBeenCalledWith(
        "c-123",
        mockMessage,
      );
    });
  });

  describe("generateMediaUploadUrl", () => {
    it("should call chatService.generateMediaUploadUrl and return presigned URL", async () => {
      const mockResponse = {
        uploadUrl: "https://s3.amazonaws.com/presigned-put",
        mediaUrl: "https://s3.amazonaws.com/image.jpg",
        s3Key: "consultations/c-123/chat/image.jpg",
        expiresInSeconds: 900,
      };
      mockChatService.generateMediaUploadUrl.mockResolvedValue(mockResponse);

      const result = await controller.generateMediaUploadUrl("c-123", mockUser, {
        fileName: "image.jpg",
        contentType: "image/jpeg",
        fileSizeBytes: 1024,
      });

      expect(result).toEqual(mockResponse);
      expect(mockChatService.generateMediaUploadUrl).toHaveBeenCalledWith(
        "c-123",
        mockUser,
        {
          fileName: "image.jpg",
          contentType: "image/jpeg",
          fileSizeBytes: 1024,
        },
      );
    });
  });

  describe("markMessagesRead", () => {
    it("should call chatService.markMessagesRead and return count", async () => {
      mockChatService.markMessagesRead.mockResolvedValue({ updatedCount: 2 });

      const result = await controller.markMessagesRead("c-123", mockUser, {
        messageIds: ["msg-1", "msg-2"],
      });

      expect(result).toEqual({ updatedCount: 2 });
      expect(mockChatService.markMessagesRead).toHaveBeenCalledWith(
        "c-123",
        mockUser,
        { messageIds: ["msg-1", "msg-2"] },
      );
    });
  });
});
