import { ConsultationMessageType, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationMessageEntity } from "../entities/consultation-message.entity";
import { ConsultationMessageRepository } from "./consultation-message.repository";

describe("ConsultationMessageRepository", () => {
  let repository: ConsultationMessageRepository;
  let mockPrisma: any;

  const sampleDbRecord = {
    id: "msg-1",
    consultationId: "consult-1",
    senderId: "user-1",
    content: "Need advice on bovine temperature.",
    mediaUrls: [],
    messageType: "TEXT",
    readAt: null,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T10:00:00.000Z"),
    sender: {
      id: "user-1",
      name: "Farmer Dave",
      role: UserRole.FARMER,
    },
  };

  beforeEach(() => {
    mockPrisma = {
      consultationMessage: {
        create: jest.fn().mockResolvedValue(sampleDbRecord),
        findUnique: jest.fn().mockResolvedValue(sampleDbRecord),
        findMany: jest.fn().mockResolvedValue([sampleDbRecord]),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    repository = new ConsultationMessageRepository(mockPrisma as PrismaService);
  });

  describe("create", () => {
    it("should persist message and return domain entity", async () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "Need advice on bovine temperature.",
      });

      const result = await repository.create(entity);

      expect(result).toBeDefined();
      expect(result.id).toBe("msg-1");
      expect(mockPrisma.consultationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consultationId: "consult-1",
            senderId: "user-1",
            content: "Need advice on bovine temperature.",
          }),
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return null if record not found", async () => {
      mockPrisma.consultationMessage.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });

    it("should return message entity if found", async () => {
      const result = await repository.findById("msg-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("msg-1");
      expect(result?.senderName).toBe("Farmer Dave");
    });
  });

  describe("findByConsultation", () => {
    it("should return paginated message entities and total count", async () => {
      const result = await repository.findByConsultation("consult-1", 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.consultationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { consultationId: "consult-1" },
          skip: 0,
          take: 20,
          orderBy: { createdAt: "asc" },
        }),
      );
    });

    it("should apply before cursor if provided", async () => {
      const beforeDate = new Date("2026-09-20T09:00:00.000Z");
      await repository.findByConsultation("consult-1", 1, 20, beforeDate);

      expect(mockPrisma.consultationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            consultationId: "consult-1",
            createdAt: { lt: beforeDate },
          },
        }),
      );
    });
  });

  describe("markAsRead", () => {
    it("should update unread messages to read and return updated count", async () => {
      const readAt = new Date();
      const count = await repository.markAsRead(
        "consult-1",
        ["msg-1", "msg-2"],
        readAt,
      );

      expect(count).toBe(1);
      expect(mockPrisma.consultationMessage.updateMany).toHaveBeenCalledWith({
        where: {
          consultationId: "consult-1",
          id: { in: ["msg-1", "msg-2"] },
          readAt: null,
        },
        data: {
          readAt,
        },
      });
    });
  });
});
