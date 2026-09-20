import {
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
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IVideoRoomProvider } from "../providers/video-room-provider.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { VideoRoomService } from "./video-room.service";

describe("VideoRoomService", () => {
  let service: VideoRoomService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockVideoRoomProvider: jest.Mocked<IVideoRoomProvider>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;

  const mockVetUser: JwtPayload = {
    sub: "vet-user-1",
    email: "vet@test.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockFarmerUser: JwtPayload = {
    sub: "farmer-user-1",
    email: "farmer@test.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockAdminUser: JwtPayload = {
    sub: "admin-user-1",
    email: "admin@test.com",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const createSampleConsultation = (props?: Partial<any>) => {
    return ConsultationEntity.fromPersistence({
      id: "consult-1",
      farmerId: "farmer-user-1",
      vetId: "vet-user-1",
      farmId: "farm-1",
      animalId: "animal-1",
      chiefComplaint: "Acute respiratory distress in bovine calf.",
      mediaUrls: [],
      type: ConsultationType.LIVE_VIDEO,
      status: ConsultationStatus.ASSIGNED,
      roomSessionId: null,
      feeCents: 4500,
      paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      paymentIntentId: "pi_test_hold_123",
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
      save: jest.fn().mockImplementation(async (entity) => entity),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockVideoRoomProvider = {
      createRoom: jest.fn().mockResolvedValue({
        id: "room-id-1",
        name: "vetralink-consult-consult-1",
        url: "https://mock.daily.co/vetralink-consult-consult-1",
        privacy: "private",
        maxParticipants: 2,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      }),
      getRoom: jest.fn().mockResolvedValue(null),
      deleteRoom: jest.fn().mockResolvedValue(true),
      createMeetingToken: jest.fn().mockResolvedValue({
        token: "mock-ephemeral-jwt-token-xyz",
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      }),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: "Dr. Veterinarian" }),
      },
      farmMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    service = new VideoRoomService(
      mockConsultationRepo,
      mockVideoRoomProvider,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
    );
  });

  describe("provisionVideoRoom", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.provisionVideoRoom("non-existent-id", mockVetUser),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if consultation type is not LIVE_VIDEO", async () => {
      const consult = createSampleConsultation({
        type: ConsultationType.ASYNC_TICKET,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.provisionVideoRoom("consult-1", mockVetUser),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if consultation status is not ASSIGNED or IN_PROGRESS", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.SUBMITTED,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.provisionVideoRoom("consult-1", mockVetUser),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if payment hold is missing when feeCents > 0", async () => {
      const consult = createSampleConsultation({
        feeCents: 5000,
        paymentStatus: ConsultationPaymentStatus.UNPAID,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.provisionVideoRoom("consult-1", mockVetUser),
      ).rejects.toThrow(
        "Payment authorization hold required before video room can be provisioned.",
      );
    });

    it("should allow provisioning if feeCents === 0 regardless of payment status", async () => {
      const consult = createSampleConsultation({
        feeCents: 0,
        paymentStatus: ConsultationPaymentStatus.UNPAID,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.provisionVideoRoom("consult-1", mockVetUser);

      expect(result).toBeDefined();
      expect(result.roomName).toBe("vetralink-consult-consult-1");
      expect(mockVideoRoomProvider.createRoom).toHaveBeenCalled();
    });

    it("should throw ForbiddenOperationException if requesting user has no relationship to the consultation", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const unrelatedUser: JwtPayload = {
        sub: "unrelated-user-999",
        email: "other@farm.com",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };

      await expect(
        service.provisionVideoRoom("consult-1", unrelatedUser),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should allow farm member to provision if user is in farmMember table", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const farmWorker: JwtPayload = {
        sub: "farm-worker-2",
        email: "worker@farm.com",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };

      mockPrisma.farmMember.findUnique.mockResolvedValue({
        id: "mem-1",
        farmId: "farm-1",
        userId: "farm-worker-2",
      });

      const result = await service.provisionVideoRoom("consult-1", farmWorker);
      expect(result).toBeDefined();
      expect(mockVideoRoomProvider.createRoom).toHaveBeenCalled();
    });

    it("should return existing room if provider already has the room created", async () => {
      const consult = createSampleConsultation({
        roomSessionId: "existing-room-123",
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      mockVideoRoomProvider.getRoom.mockResolvedValue({
        id: "existing-id",
        name: "existing-room-123",
        url: "https://mock.daily.co/existing-room-123",
        privacy: "private",
        maxParticipants: 2,
        createdAt: "2026-09-20T00:00:00.000Z",
        expiresAt: "2026-09-20T02:00:00.000Z",
      });

      const result = await service.provisionVideoRoom("consult-1", mockVetUser);

      expect(result.roomName).toBe("existing-room-123");
      expect(mockVideoRoomProvider.createRoom).not.toHaveBeenCalled();
      expect(mockConsultationRepo.save).not.toHaveBeenCalled();
    });

    it("should create new room, transition ASSIGNED to IN_PROGRESS, save consultation and record audit log", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.ASSIGNED,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.provisionVideoRoom(
        "consult-1",
        mockVetUser,
        "trace-123",
      );

      expect(result.roomName).toBe("vetralink-consult-consult-1");
      expect(result.maxParticipants).toBe(2);
      expect(result.privacy).toBe("private");
      expect(mockVideoRoomProvider.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "vetralink-consult-consult-1",
          privacy: "private",
          properties: expect.objectContaining({
            maxParticipants: 2,
            enableChat: true,
            enableScreenshare: true,
          }),
        }),
      );
      expect(consult.status).toBe(ConsultationStatus.IN_PROGRESS);
      expect(consult.roomSessionId).toBe("vetralink-consult-consult-1");
      expect(mockConsultationRepo.save).toHaveBeenCalledWith(consult);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockVetUser.sub,
          action: "CONSULTATION_ROOM_PROVISIONED",
          entityId: "consult-1",
          traceId: "trace-123",
        }),
      );
    });
  });

  describe("joinVideoRoom", () => {
    it("should generate owner meeting token for attending veterinarian", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
        roomSessionId: "vetralink-consult-consult-1",
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);
      mockPrisma.user.findUnique.mockResolvedValue({ name: "Dr. Jane Vet" });

      const result = await service.joinVideoRoom("consult-1", mockVetUser);

      expect(result.isOwner).toBe(true);
      expect(result.userName).toBe("Dr. Jane Vet");
      expect(result.token).toBe("mock-ephemeral-jwt-token-xyz");
      expect(mockVideoRoomProvider.createMeetingToken).toHaveBeenCalledWith(
        expect.objectContaining({
          roomName: "vetralink-consult-consult-1",
          userId: mockVetUser.sub,
          userName: "Dr. Jane Vet",
          isOwner: true,
        }),
      );
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONSULTATION_ROOM_JOINED",
          userId: mockVetUser.sub,
          entityId: "consult-1",
        }),
      );
    });

    it("should generate owner meeting token for admin", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);
      mockPrisma.user.findUnique.mockResolvedValue({ name: "System Admin" });

      const result = await service.joinVideoRoom("consult-1", mockAdminUser);

      expect(result.isOwner).toBe(true);
      expect(result.userName).toBe("System Admin");
      expect(mockVideoRoomProvider.createMeetingToken).toHaveBeenCalledWith(
        expect.objectContaining({
          isOwner: true,
        }),
      );
    });

    it("should generate non-owner meeting token for farmer client", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);
      mockPrisma.user.findUnique.mockResolvedValue({ name: "Farmer Joe" });

      const result = await service.joinVideoRoom("consult-1", mockFarmerUser);

      expect(result.isOwner).toBe(false);
      expect(result.userName).toBe("Farmer Joe");
      expect(mockVideoRoomProvider.createMeetingToken).toHaveBeenCalledWith(
        expect.objectContaining({
          isOwner: false,
          userName: "Farmer Joe",
        }),
      );
    });
  });

  describe("endVideoRoom", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.endVideoRoom("non-existent-id", mockVetUser),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if a farmer tries to end the room", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.endVideoRoom("consult-1", mockFarmerUser),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should teardown room, complete consultation, and record audit log when vet ends session", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
        roomSessionId: "vetralink-consult-consult-1",
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.endVideoRoom("consult-1", mockVetUser, "trace-end-1");

      expect(result.roomName).toBe("vetralink-consult-consult-1");
      expect(result.endedAt).toBeDefined();
      expect(mockVideoRoomProvider.deleteRoom).toHaveBeenCalledWith(
        "vetralink-consult-consult-1",
      );
      expect(consult.status).toBe(ConsultationStatus.COMPLETED);
      expect(mockConsultationRepo.save).toHaveBeenCalledWith(consult);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockVetUser.sub,
          action: "CONSULTATION_ROOM_TERMINATED",
          entityId: "consult-1",
          traceId: "trace-end-1",
        }),
      );
    });

    it("should allow admin to teardown room", async () => {
      const consult = createSampleConsultation({
        status: ConsultationStatus.IN_PROGRESS,
      });
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.endVideoRoom("consult-1", mockAdminUser);

      expect(result).toBeDefined();
      expect(mockVideoRoomProvider.deleteRoom).toHaveBeenCalled();
      expect(consult.status).toBe(ConsultationStatus.COMPLETED);
    });
  });
});
