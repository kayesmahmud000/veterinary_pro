import {
  ConsultationMessageType,
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { IS3StorageService } from "../../media/services/s3-storage.service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationMessageEntity } from "../entities/consultation-message.entity";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationMessageRepository } from "../repositories/consultation-message.repository.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { ConsultationChatService } from "./consultation-chat.service";

describe("ConsultationChatService", () => {
  let service: ConsultationChatService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockMessageRepo: jest.Mocked<IConsultationMessageRepository>;
  let mockS3Storage: jest.Mocked<IS3StorageService>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;
  let mockEnvService: any;

  const mockFarmerUser: JwtPayload = {
    sub: "farmer-1",
    email: "farmer@test.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockVetUser: JwtPayload = {
    sub: "vet-1",
    email: "vet@test.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockUnrelatedUser: JwtPayload = {
    sub: "unrelated-1",
    email: "other@test.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const createSampleConsultation = (props?: Partial<any>) => {
    return ConsultationEntity.fromPersistence({
      id: "consult-1",
      farmerId: "farmer-1",
      vetId: "vet-1",
      farmId: "farm-1",
      animalId: "animal-1",
      chiefComplaint: "Cow with fever and respiratory distress.",
      mediaUrls: [],
      type: ConsultationType.LIVE_VIDEO,
      status: ConsultationStatus.IN_PROGRESS,
      roomSessionId: "room-1",
      feeCents: 3000,
      paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      paymentIntentId: "pi_123",
      paymentHeldAt: new Date(),
      paymentCapturedAt: null,
      paymentReleasedAt: null,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
    });
  };

  beforeEach(() => {
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

    mockMessageRepo = {
      create: jest.fn().mockImplementation(async (entity) => entity),
      findById: jest.fn(),
      findByConsultation: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      markAsRead: jest.fn().mockResolvedValue(1),
    };

    mockS3Storage = {
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      getPresignedPutUrl: jest
        .fn()
        .mockResolvedValue("https://s3.amazonaws.com/presigned-put-url"),
      getPresignedGetUrl: jest.fn(),
      downloadFile: jest.fn(),
      uploadFileFromDisk: jest.fn(),
      deleteObject: jest.fn(),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: "Farmer John" }),
      },
      farmMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    mockEnvService = {
      s3BucketMedia: "vetralink-media",
      s3Endpoint: "http://localhost:9000",
      awsRegion: "us-east-1",
    };

    service = new ConsultationChatService(
      mockConsultationRepo,
      mockMessageRepo,
      mockS3Storage,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
      mockEnvService as EnvService,
    );
  });

  describe("sendMessage", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.sendMessage("non-existent", mockFarmerUser, {
          content: "Hello",
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if user is not authorized", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.sendMessage("consult-1", mockUnrelatedUser, {
          content: "Hello",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if consultation is COMPLETED", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.COMPLETED,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.sendMessage("consult-1", mockFarmerUser, {
          content: "Hello",
        }),
      ).rejects.toThrow("Cannot send messages to a closed or cancelled consultation.");
    });

    it("should create and return text message", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.sendMessage("consult-1", mockFarmerUser, {
        content: "What medication should I give?",
      });

      expect(result.content).toBe("What medication should I give?");
      expect(result.senderId).toBe(mockFarmerUser.sub);
      expect(result.senderName).toBe("Farmer John");
      expect(result.messageType).toBe(ConsultationMessageType.TEXT);
      expect(mockMessageRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).not.toHaveBeenCalled();
    });

    it("should record audit log when media attachments are present", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.sendMessage(
        "consult-1",
        mockFarmerUser,
        {
          content: "Here is the wound photo",
          mediaUrls: [
            {
              url: "https://s3.amazonaws.com/wound.jpg",
              name: "wound.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 1024,
            },
          ],
        },
        "trace-xyz",
      );

      expect(result.mediaUrls).toHaveLength(1);
      expect(result.messageType).toBe(ConsultationMessageType.IMAGE);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_CHAT_MEDIA_SHARED",
          traceId: "trace-xyz",
        }),
      );
    });
  });

  describe("getMessages", () => {
    it("should return paginated message DTOs", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const mockEntity = ConsultationMessageEntity.create({
        consultationId: "consult-1",
        senderId: "vet-1",
        content: "Give antibiotic daily.",
        senderName: "Dr. Vet",
        senderRole: UserRole.VET,
      });

      mockMessageRepo.findByConsultation.mockResolvedValue({
        items: [mockEntity],
        total: 1,
      });

      const result = await service.getMessages("consult-1", mockVetUser, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].content).toBe("Give antibiotic daily.");
    });
  });

  describe("generateMediaUploadUrl", () => {
    it("should throw ValidationDomainException if MIME type is unsupported", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.generateMediaUploadUrl("consult-1", mockFarmerUser, {
          fileName: "malware.exe",
          contentType: "application/x-msdownload",
          fileSizeBytes: 1024,
        }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if file size exceeds 25 MB", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.generateMediaUploadUrl("consult-1", mockFarmerUser, {
          fileName: "large-video.mp4",
          contentType: "video/mp4",
          fileSizeBytes: 30 * 1024 * 1024, // 30 MB
        }),
      ).rejects.toThrow("Media attachment size must be between 1 byte and 25 MB");
    });

    it("should generate presigned PUT URL for valid media upload", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.generateMediaUploadUrl(
        "consult-1",
        mockFarmerUser,
        {
          fileName: "calf_lesion.jpg",
          contentType: "image/jpeg",
          fileSizeBytes: 2048,
        },
      );

      expect(result.uploadUrl).toBe("https://s3.amazonaws.com/presigned-put-url");
      expect(result.s3Key).toContain("consultations/consult-1/chat/");
      expect(result.s3Key).toContain("calf_lesion.jpg");
      expect(result.mediaUrl).toBe(
        `http://localhost:9000/vetralink-media/${result.s3Key}`,
      );
      expect(result.expiresInSeconds).toBe(900);
    });
  });

  describe("markMessagesRead", () => {
    it("should mark messages as read and return count", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);
      mockMessageRepo.markAsRead.mockResolvedValue(3);

      const result = await service.markMessagesRead("consult-1", mockVetUser, {
        messageIds: ["msg-1", "msg-2", "msg-3"],
      });

      expect(result.updatedCount).toBe(3);
      expect(mockMessageRepo.markAsRead).toHaveBeenCalledWith(
        "consult-1",
        ["msg-1", "msg-2", "msg-3"],
        expect.any(Date),
      );
    });

    it("should return 0 if messageIds is empty", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.markMessagesRead("consult-1", mockVetUser, {
        messageIds: [],
      });

      expect(result.updatedCount).toBe(0);
      expect(mockMessageRepo.markAsRead).not.toHaveBeenCalled();
    });
  });
});
