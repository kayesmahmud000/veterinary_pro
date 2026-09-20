import {
  ConsultationNotificationChannel,
  ConsultationNotificationStatus,
  ConsultationStatus,
  ConsultationType,
  UserRole,
} from "@vetralink/shared-types";
import { firstValueFrom, take } from "rxjs";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import {
  IPushNotificationProvider,
  ISmsNotificationProvider,
} from "../../clinical-health/providers/notification-provider.interface";
import { IMailService } from "../../mail/interfaces/mail-service.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { ConsultationNotificationLogEntity } from "../entities/consultation-notification-log.entity";
import { IConsultationNotificationLogRepository } from "../repositories/consultation-notification-log.repository.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { ConsultationNotificationService } from "./consultation-notification.service";

describe("ConsultationNotificationService", () => {
  let service: ConsultationNotificationService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockNotificationLogRepo: jest.Mocked<IConsultationNotificationLogRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;
  let mockPiiCrypto: jest.Mocked<PiiCryptoService>;
  let mockPushProvider: jest.Mocked<IPushNotificationProvider>;
  let mockSmsProvider: jest.Mocked<ISmsNotificationProvider>;
  let mockMailService: jest.Mocked<IMailService>;

  const mockConsultationRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow exhibiting acute bloat and distress",
    mediaUrls: [],
    type: ConsultationType.LIVE_VIDEO,
    status: ConsultationStatus.ASSIGNED,
    roomSessionId: null,
    feeCents: 2500,
    scheduledAt: new Date("2026-09-21T14:00:00Z"),
    assignedAt: new Date("2026-09-20T10:00:00Z"),
    createdAt: new Date("2026-09-20T09:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    animal: {
      id: "animal-1",
      name: "Bessie",
      tagNumber: "COW-101",
      species: "COW",
    },
    farm: {
      id: "farm-1",
      name: "Green Valley Farm",
    },
    farmer: {
      id: "farmer-1",
      name: "John Farmer",
      email: "john@farmer.com",
    },
  };

  const mockVetUser = {
    id: "vet-1",
    name: "Dr. Sarah",
    email: "sarah@vet.com",
    phone: "encrypted-phone-payload",
    role: UserRole.VET,
    status: "ACTIVE",
    deletedAt: null,
  };

  beforeEach(() => {
    mockConsultationRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      getTriageMetrics: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockNotificationLogRepo = {
      create: jest
        .fn()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
      findById: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
      findByVet: jest.fn(),
      findByConsultation: jest.fn(),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    } as any;

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    mockPiiCrypto = {
      decrypt: jest.fn().mockReturnValue("+1234567890"),
      encrypt: jest.fn().mockReturnValue("encrypted"),
      normalizePhone: jest.fn().mockReturnValue("+1234567890"),
      hashPhone: jest.fn().mockReturnValue("hash"),
      maskPhone: jest.fn().mockReturnValue("+123****890"),
    } as any;

    mockPushProvider = {
      sendPush: jest.fn().mockResolvedValue({
        success: true,
        messageId: "push-123",
      }),
    };

    mockSmsProvider = {
      sendSms: jest.fn().mockResolvedValue({
        success: true,
        messageId: "sms-123",
      }),
    };

    mockMailService = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: "mail-123",
      }),
      sendOrderFulfillmentEmail: jest.fn(),
    };

    service = new ConsultationNotificationService(
      mockConsultationRepo,
      mockNotificationLogRepo,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
      mockPiiCrypto,
      mockPushProvider,
      mockSmsProvider,
      mockMailService,
    );
  });

  describe("dispatchAssignmentNotification", () => {
    it("should dispatch notifications across all 4 channels successfully by default", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue(mockVetUser);

      const result = await service.dispatchAssignmentNotification(
        "consult-123",
        "vet-1",
      );

      expect(result.consultationId).toBe("consult-123");
      expect(result.vetId).toBe("vet-1");
      expect(result.channels).toHaveLength(4);

      // Verify each channel
      const inApp = result.channels.find(
        (c) => c.channel === ConsultationNotificationChannel.IN_APP,
      );
      expect(inApp?.status).toBe(ConsultationNotificationStatus.SENT);

      const push = result.channels.find(
        (c) => c.channel === ConsultationNotificationChannel.PUSH,
      );
      expect(push?.status).toBe(ConsultationNotificationStatus.SENT);
      expect(mockPushProvider.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "vet-1",
          title: expect.stringContaining("Live Video Consultation Assigned"),
        }),
      );

      const sms = result.channels.find(
        (c) => c.channel === ConsultationNotificationChannel.SMS,
      );
      expect(sms?.status).toBe(ConsultationNotificationStatus.SENT);
      expect(mockPiiCrypto.decrypt).toHaveBeenCalledWith("encrypted-phone-payload");
      expect(mockSmsProvider.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+1234567890",
          body: expect.stringContaining("[VETRALINK]"),
        }),
      );

      const email = result.channels.find(
        (c) => c.channel === ConsultationNotificationChannel.EMAIL,
      );
      expect(email?.status).toBe(ConsultationNotificationStatus.SENT);
      expect(mockMailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "sarah@vet.com",
          subject: expect.stringContaining("[VETRALINK Tele-Vet]"),
        }),
      );

      expect(mockNotificationLogRepo.create).toHaveBeenCalledTimes(4);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_NOTIFICATION_DISPATCHED",
          entityId: "consult-123",
        }),
      );
    });

    it("should dispatch only specified channels when options.channels is provided", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue(mockVetUser);

      const result = await service.dispatchAssignmentNotification(
        "consult-123",
        "vet-1",
        {
          channels: [
            ConsultationNotificationChannel.IN_APP,
            ConsultationNotificationChannel.PUSH,
          ],
          customNote: "Urgent check required",
        },
      );

      expect(result.channels).toHaveLength(2);
      expect(mockPushProvider.sendPush).toHaveBeenCalled();
      expect(mockSmsProvider.sendSms).not.toHaveBeenCalled();
      expect(mockMailService.sendEmail).not.toHaveBeenCalled();
    });

    it("should emit to real-time SSE stream when IN_APP notification is dispatched", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue(mockVetUser);

      const stream$ = service.getNotificationStream("vet-1");
      const eventPromise = firstValueFrom(stream$.pipe(take(1)));

      await service.dispatchAssignmentNotification("consult-123", "vet-1", {
        channels: [ConsultationNotificationChannel.IN_APP],
      });

      const event = await eventPromise;
      expect(event).toBeDefined();
      expect(event.data.consultationId).toBe("consult-123");
      expect(event.data.vetId).toBe("vet-1");
      expect(event.data.channel).toBe(ConsultationNotificationChannel.IN_APP);
    });

    it("should handle missing phone number gracefully and mark SMS as FAILED without throwing", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockVetUser,
        phone: null,
      });

      const result = await service.dispatchAssignmentNotification(
        "consult-123",
        "vet-1",
        {
          channels: [ConsultationNotificationChannel.SMS],
        },
      );

      expect(result.channels[0]?.channel).toBe(
        ConsultationNotificationChannel.SMS,
      );
      expect(result.channels[0]?.status).toBe(
        ConsultationNotificationStatus.FAILED,
      );
      expect(result.channels[0]?.error).toContain("no phone number");
    });

    it("should handle external push provider failure gracefully", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue(mockVetUser);
      mockPushProvider.sendPush.mockResolvedValue({
        success: false,
        error: "FCM Gateway Timeout",
      });

      const result = await service.dispatchAssignmentNotification(
        "consult-123",
        "vet-1",
        {
          channels: [ConsultationNotificationChannel.PUSH],
        },
      );

      expect(result.channels[0]?.status).toBe(
        ConsultationNotificationStatus.FAILED,
      );
      expect(result.channels[0]?.error).toBe("FCM Gateway Timeout");
    });

    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.dispatchAssignmentNotification("invalid-id", "vet-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if target user is not an active veterinarian", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockVetUser,
        role: UserRole.FARMER,
      });

      await expect(
        service.dispatchAssignmentNotification("consult-123", "vet-1"),
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getVetNotifications", () => {
    it("should return paginated notifications with unread count", async () => {
      const mockEntity = ConsultationNotificationLogEntity.create({
        consultationId: "consult-123",
        vetId: "vet-1",
        channel: ConsultationNotificationChannel.IN_APP,
        title: "Test Title",
        message: "Test Message",
      });

      mockNotificationLogRepo.findByVet.mockResolvedValue({
        items: [mockEntity],
        total: 1,
        unreadCount: 1,
      });

      const result = await service.getVetNotifications("vet-1", {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read successfully", async () => {
      const mockEntity = ConsultationNotificationLogEntity.create({
        id: "log-1",
        consultationId: "consult-123",
        vetId: "vet-1",
        channel: ConsultationNotificationChannel.IN_APP,
        title: "Test Title",
        message: "Test Message",
      });

      mockNotificationLogRepo.findById.mockResolvedValue(mockEntity);

      const result = await service.markAsRead("log-1", "vet-1");

      expect(result.readAt).not.toBeNull();
      expect(mockNotificationLogRepo.save).toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException if notification does not exist", async () => {
      mockNotificationLogRepo.findById.mockResolvedValue(null);

      await expect(service.markAsRead("not-found", "vet-1")).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it("should throw ForbiddenOperationException if vetId does not match log's vetId", async () => {
      const mockEntity = ConsultationNotificationLogEntity.create({
        id: "log-1",
        consultationId: "consult-123",
        vetId: "vet-2",
        channel: ConsultationNotificationChannel.IN_APP,
        title: "Test Title",
        message: "Test Message",
      });

      mockNotificationLogRepo.findById.mockResolvedValue(mockEntity);

      await expect(service.markAsRead("log-1", "vet-1")).rejects.toThrow(
        ForbiddenOperationException,
      );
    });
  });
});
