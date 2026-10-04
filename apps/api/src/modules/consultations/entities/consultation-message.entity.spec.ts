import {
  ConsultationMessageType,
  UserRole,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { ConsultationMessageEntity } from "./consultation-message.entity";

describe("ConsultationMessageEntity", () => {
  describe("create", () => {
    it("should throw ValidationDomainException if consultationId is empty", () => {
      expect(() =>
        ConsultationMessageEntity.create({
          consultationId: "",
          senderId: "user-1",
          content: "Hello",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if senderId is empty", () => {
      expect(() =>
        ConsultationMessageEntity.create({
          consultationId: "consult-1",
          senderId: "  ",
          content: "Hello",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if content and media are both empty", () => {
      expect(() =>
        ConsultationMessageEntity.create({
          consultationId: "consult-1",
          senderId: "user-1",
          content: "   ",
          mediaUrls: [],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should create text message successfully", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "  Hello Doctor!  ",
        senderName: "Farmer John",
        senderRole: UserRole.FARMER,
      });

      expect(entity.id).toBeDefined();
      expect(entity.consultationId).toBe("consult-1");
      expect(entity.senderId).toBe("user-1");
      expect(entity.content).toBe("Hello Doctor!");
      expect(entity.mediaUrls).toEqual([]);
      expect(entity.messageType).toBe(ConsultationMessageType.TEXT);
      expect(entity.readAt).toBeNull();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.senderName).toBe("Farmer John");
      expect(entity.senderRole).toBe(UserRole.FARMER);
    });

    it("should auto-resolve IMAGE messageType when image media attachment provided", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "",
        mediaUrls: [
          {
            url: "https://s3.amazonaws.com/lesion.jpg",
            name: "lesion.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 1024,
          },
        ],
      });

      expect(entity.messageType).toBe(ConsultationMessageType.IMAGE);
      expect(entity.mediaUrls).toHaveLength(1);
    });

    it("should auto-resolve VIDEO messageType when video media attachment provided", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "Wound video",
        mediaUrls: [
          {
            url: "https://s3.amazonaws.com/gait.mp4",
            name: "gait.mp4",
            mimeType: "video/mp4",
            sizeBytes: 2048,
          },
        ],
      });

      expect(entity.messageType).toBe(ConsultationMessageType.VIDEO);
    });

    it("should auto-resolve DOCUMENT messageType when pdf media attachment provided", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "Blood test report",
        mediaUrls: [
          {
            url: "https://s3.amazonaws.com/report.pdf",
            name: "report.pdf",
            mimeType: "application/pdf",
            sizeBytes: 5000,
          },
        ],
      });

      expect(entity.messageType).toBe(ConsultationMessageType.DOCUMENT);
    });
  });

  describe("markAsRead", () => {
    it("should set readAt timestamp when marked as read", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "Test message",
      });

      expect(entity.readAt).toBeNull();

      const readTime = new Date();
      entity.markAsRead(readTime);

      expect(entity.readAt).toEqual(readTime);
    });

    it("should not overwrite readAt if already marked as read", () => {
      const entity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "user-1",
        content: "Test message",
      });

      const firstRead = new Date("2026-09-20T10:00:00.000Z");
      const secondRead = new Date("2026-09-20T11:00:00.000Z");

      entity.markAsRead(firstRead);
      entity.markAsRead(secondRead);

      expect(entity.readAt).toEqual(firstRead);
    });
  });

  describe("fromPersistence & toDto", () => {
    it("should reconstitute from persistence and serialize to DTO", () => {
      const raw = {
        id: "msg-123",
        consultationId: "consult-1",
        senderId: "vet-1",
        content: "Follow up tomorrow morning.",
        mediaUrls: JSON.stringify([
          {
            url: "https://s3.amazonaws.com/doc.pdf",
            name: "doc.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1000,
          },
        ]),
        messageType: "DOCUMENT",
        readAt: "2026-09-20T12:00:00.000Z",
        createdAt: "2026-09-20T11:00:00.000Z",
        updatedAt: "2026-09-20T12:00:00.000Z",
        sender: {
          id: "vet-1",
          name: "Dr. Smith",
          role: UserRole.VET,
        },
      };

      const entity = ConsultationMessageEntity.fromPersistence(raw);

      expect(entity.id).toBe("msg-123");
      expect(entity.senderName).toBe("Dr. Smith");
      expect(entity.senderRole).toBe(UserRole.VET);
      expect(entity.messageType).toBe(ConsultationMessageType.DOCUMENT);
      expect(entity.mediaUrls).toHaveLength(1);

      const dto = entity.toDto();
      expect(dto.id).toBe("msg-123");
      expect(dto.senderName).toBe("Dr. Smith");
      expect(dto.readAt).toBe("2026-09-20T12:00:00.000Z");
      expect(dto.mediaUrls[0].name).toBe("doc.pdf");
    });
  });
});
