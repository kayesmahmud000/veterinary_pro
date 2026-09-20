import {
  ConsultationNotificationChannel,
  ConsultationNotificationStatus,
  ConsultationStatus,
  ConsultationType,
  UserRole,
} from "@vetralink/shared-types";
import { firstValueFrom, of } from "rxjs";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import {
  ConsultationSseEvent,
  IConsultationNotificationService,
} from "../services/consultation-notification.service.interface";
import { ConsultationNotificationController } from "./consultation-notification.controller";

describe("ConsultationNotificationController", () => {
  let controller: ConsultationNotificationController;
  let mockNotificationService: jest.Mocked<IConsultationNotificationService>;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;

  const mockConsultationRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: "vet-1",
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow bloat",
    mediaUrls: [],
    type: ConsultationType.LIVE_VIDEO,
    status: ConsultationStatus.ASSIGNED,
    roomSessionId: null,
    feeCents: 2500,
    scheduledAt: new Date("2026-09-21T14:00:00Z"),
    assignedAt: new Date("2026-09-20T10:00:00Z"),
    createdAt: new Date("2026-09-20T09:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
  };

  const mockAdminUser = {
    sub: "admin-1",
    email: "admin@vetralink.pro",
    role: UserRole.ADMIN,
  };

  const mockVetUser = {
    sub: "vet-1",
    email: "sarah@vet.com",
    role: UserRole.VET,
  };

  const mockOtherVetUser = {
    sub: "vet-2",
    email: "other@vet.com",
    role: UserRole.VET,
  };

  beforeEach(() => {
    mockNotificationService = {
      dispatchAssignmentNotification: jest.fn(),
      getVetNotifications: jest.fn(),
      markAsRead: jest.fn(),
      getNotificationStream: jest.fn(),
    };

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

    controller = new ConsultationNotificationController(
      mockNotificationService,
      mockConsultationRepo,
    );
  });

  describe("notifyAssignedVet", () => {
    it("should dispatch notification to assigned vet successfully", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence(mockConsultationRecord),
      );
      mockNotificationService.dispatchAssignmentNotification.mockResolvedValue({
        consultationId: "consult-123",
        vetId: "vet-1",
        channels: [
          {
            channel: ConsultationNotificationChannel.IN_APP,
            status: ConsultationNotificationStatus.SENT,
          },
        ],
        dispatchedAt: new Date().toISOString(),
      });

      const result = await controller.notifyAssignedVet(
        "consult-123",
        {
          channels: [ConsultationNotificationChannel.IN_APP],
          customNote: "Urgent case",
        },
        mockAdminUser as any,
      );

      expect(result.consultationId).toBe("consult-123");
      expect(
        mockNotificationService.dispatchAssignmentNotification,
      ).toHaveBeenCalledWith(
        "consult-123",
        "vet-1",
        expect.objectContaining({
          channels: [ConsultationNotificationChannel.IN_APP],
          customNote: "Urgent case",
        }),
      );
    });

    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        controller.notifyAssignedVet(
          "invalid-id",
          {},
          mockAdminUser as any,
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if consultation has no assigned vet", async () => {
      mockConsultationRepo.findById.mockResolvedValue(
        ConsultationEntity.fromPersistence({
          ...mockConsultationRecord,
          vetId: null,
        }),
      );

      await expect(
        controller.notifyAssignedVet(
          "consult-123",
          {},
          mockAdminUser as any,
        ),
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getVetNotifications", () => {
    it("should allow a veterinarian to view their own notifications", async () => {
      mockNotificationService.getVetNotifications.mockResolvedValue({
        items: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          unreadCount: 0,
        },
      });

      const result = await controller.getVetNotifications(
        "vet-1",
        { page: 1, limit: 20 },
        mockVetUser as any,
      );

      expect(result.meta.total).toBe(0);
      expect(mockNotificationService.getVetNotifications).toHaveBeenCalledWith(
        "vet-1",
        { page: 1, limit: 20 },
      );
    });

    it("should allow an admin to view any veterinarian's notifications", async () => {
      mockNotificationService.getVetNotifications.mockResolvedValue({
        items: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          unreadCount: 0,
        },
      });

      const result = await controller.getVetNotifications(
        "vet-1",
        {},
        mockAdminUser as any,
      );

      expect(result.meta.total).toBe(0);
    });

    it("should throw ForbiddenOperationException if a vet tries to view another vet's notifications", async () => {
      await expect(
        controller.getVetNotifications(
          "vet-1",
          {},
          mockOtherVetUser as any,
        ),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("markAsRead", () => {
    it("should allow a veterinarian to mark their own notification as read", async () => {
      const mockResult = {
        id: "notif-1",
        consultationId: "consult-123",
        vetId: "vet-1",
        channel: ConsultationNotificationChannel.IN_APP,
        status: ConsultationNotificationStatus.SENT,
        title: "Test",
        message: "Test message",
        readAt: new Date().toISOString(),
        dispatchedAt: new Date().toISOString(),
      };
      mockNotificationService.markAsRead.mockResolvedValue(mockResult);

      const result = await controller.markAsRead(
        "vet-1",
        "notif-1",
        mockVetUser as any,
      );

      expect(result.readAt).toBeDefined();
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        "notif-1",
        "vet-1",
      );
    });

    it("should throw ForbiddenOperationException if unauthorized user tries to mark read", async () => {
      await expect(
        controller.markAsRead(
          "vet-1",
          "notif-1",
          mockOtherVetUser as any,
        ),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("streamVetNotifications", () => {
    it("should return an observable mapping SSE events", async () => {
      const sseEvent: ConsultationSseEvent = {
        data: {
          id: "notif-1",
          consultationId: "consult-123",
          vetId: "vet-1",
          channel: ConsultationNotificationChannel.IN_APP,
          status: ConsultationNotificationStatus.SENT,
          title: "Assigned",
          message: "New consultation assigned",
          dispatchedAt: new Date().toISOString(),
        },
        type: "consultation_assigned",
        id: "notif-1",
      };

      mockNotificationService.getNotificationStream.mockReturnValue(of(sseEvent));

      const stream$ = controller.streamVetNotifications("vet-1");
      const event = await firstValueFrom(stream$);

      expect(event).toBeDefined();
      expect(event.data).toEqual(sseEvent.data);
      expect(event.type).toBe("consultation_assigned");
      expect(event.id).toBe("notif-1");
    });
  });
});
