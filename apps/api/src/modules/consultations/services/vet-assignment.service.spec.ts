import {
  ConsultationStatus,
  ConsultationType,
  UserRole,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { VetProfileEntity } from "../entities/vet-profile.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { IVetProfileRepository } from "../repositories/vet-profile.repository.interface";
import { VetAssignmentService } from "./vet-assignment.service";

describe("VetAssignmentService", () => {
  let service: VetAssignmentService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockVetProfileRepo: jest.Mocked<IVetProfileRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockNotificationService: any;
  let mockPrisma: any;

  const mockConsultationRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: null,
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow showing acute respiratory distress",
    mediaUrls: [],
    type: ConsultationType.ASYNC_TICKET,
    status: ConsultationStatus.SUBMITTED,
    roomSessionId: null,
    feeCents: 0,
    scheduledAt: null,
    assignedAt: null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    animal: {
      id: "animal-1",
      name: "Daisy",
      tagNumber: "COW-001",
      species: "COW",
    },
  };

  const mockVet1 = {
    user: {
      id: "vet-1",
      name: "Dr. Alice (Cow Specialist)",
      email: "alice@vet.com",
      avatarUrl: null,
      role: "VET",
      status: "ACTIVE",
    },
    profile: VetProfileEntity.create({
      userId: "vet-1",
      specialties: ["COW"],
      isAvailable: true,
      maxActiveCases: 5,
      workingHours: [],
    }),
  };

  const mockVet2 = {
    user: {
      id: "vet-2",
      name: "Dr. Bob (Generalist)",
      email: "bob@vet.com",
      avatarUrl: null,
      role: "VET",
      status: "ACTIVE",
    },
    profile: VetProfileEntity.create({
      userId: "vet-2",
      specialties: ["GENERAL"],
      isAvailable: true,
      maxActiveCases: 5,
      workingHours: [],
    }),
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

    mockVetProfileRepo = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      findAllActiveVetsWithProfiles: jest.fn(),
      updateRatingAggregates: jest.fn().mockResolvedValue(undefined),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    } as any;

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    mockNotificationService = {
      dispatchAssignmentNotification: jest.fn().mockResolvedValue({
        consultationId: "consult-123",
        vetId: "vet-1",
        channels: [],
        dispatchedAt: new Date().toISOString(),
      }),
      getVetNotifications: jest.fn(),
      markAsRead: jest.fn(),
      getNotificationStream: jest.fn(),
    };

    service = new VetAssignmentService(
      mockConsultationRepo,
      mockVetProfileRepo,
      mockAuditLogRepo,
      mockPrisma as unknown as PrismaService,
      mockNotificationService,
    );
  });

  describe("getRankedCandidates()", () => {
    it("should rank candidates by specialty score and workload", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([
        mockVet1,
        mockVet2,
      ]);

      // Vet 1 has 1 active case, Vet 2 has 0 active cases
      mockConsultationRepo.countActiveConsultationsByVet
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const candidates = await service.getRankedCandidates("consult-123");

      expect(candidates).toHaveLength(2);
      // Vet 1 has exact match (50 pts) vs Vet 2 general match (25 pts)
      expect(candidates[0]?.vetId).toBe("vet-1");
      expect(candidates[0]?.scoreBreakdown.specialtyScore).toBe(50);
      expect(candidates[1]?.vetId).toBe("vet-2");
      expect(candidates[1]?.scoreBreakdown.specialtyScore).toBe(25);
    });

    it("should mark vet as ineligible if off-duty", async () => {
      const offDutyVet = {
        user: mockVet1.user,
        profile: VetProfileEntity.create({
          userId: "vet-1",
          isAvailable: false,
          maxActiveCases: 5,
        }),
      };

      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([offDutyVet]);
      mockConsultationRepo.countActiveConsultationsByVet.mockResolvedValue(0);

      const candidates = await service.getRankedCandidates("consult-123");

      expect(candidates[0]?.isEligible).toBe(false);
      expect(candidates[0]?.ineligibilityReason).toContain("off-duty");
    });

    it("should mark vet as ineligible if at maximum active capacity", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([mockVet1]);
      mockConsultationRepo.countActiveConsultationsByVet.mockResolvedValue(5); // 5/5

      const candidates = await service.getRankedCandidates("consult-123");

      expect(candidates[0]?.isEligible).toBe(false);
      expect(candidates[0]?.ineligibilityReason).toContain("maximum active capacity");
    });
  });

  describe("assignToVet()", () => {
    it("should assign consultation to active vet and emit audit log", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "vet-1",
        role: UserRole.VET,
        status: "ACTIVE",
        deletedAt: null,
      });

      const updatedEntity = ConsultationEntity.fromPersistence({
        ...mockConsultationRecord,
        vetId: "vet-1",
        status: ConsultationStatus.ASSIGNED,
      });
      mockConsultationRepo.save.mockResolvedValue(updatedEntity);

      const result = await service.assignToVet(
        "consult-123",
        { vetId: "vet-1", notes: "Emergency triage assignment" },
        "triage-officer-1",
        "trace-1",
      );

      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "triage-officer-1",
          action: "CONSULTATION_MANUALLY_ASSIGNED",
          entityId: "consult-123",
        }),
      );
      expect(result.status).toBe(ConsultationStatus.ASSIGNED);
      expect(result.vetId).toBe("vet-1");
      expect(
        mockNotificationService.dispatchAssignmentNotification,
      ).toHaveBeenCalledWith(
        "consult-123",
        "vet-1",
        expect.objectContaining({
          customNote: "Emergency triage assignment",
          traceId: "trace-1",
        }),
      );
    });

    it("should throw if target user is not a veterinarian", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "farmer-2",
        role: UserRole.FARMER,
        deletedAt: null,
      });

      await expect(
        service.assignToVet(
          "consult-123",
          { vetId: "farmer-2" },
          "triage-officer-1",
        ),
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("autoAssign()", () => {
    it("should select top ranked candidate and execute assignment", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([mockVet1]);
      mockConsultationRepo.countActiveConsultationsByVet.mockResolvedValue(0);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "vet-1",
        role: UserRole.VET,
        status: "ACTIVE",
        deletedAt: null,
      });

      const updatedEntity = ConsultationEntity.fromPersistence({
        ...mockConsultationRecord,
        vetId: "vet-1",
        status: ConsultationStatus.ASSIGNED,
      });
      mockConsultationRepo.save.mockResolvedValue(updatedEntity);

      const result = await service.autoAssign(
        "consult-123",
        {},
        "triage-officer-1",
      );

      expect(result.vetId).toBe("vet-1");
      expect(result.status).toBe(ConsultationStatus.ASSIGNED);
    });

    it("should throw ValidationDomainException if no eligible vets exist", async () => {
      const consultation = ConsultationEntity.fromPersistence(mockConsultationRecord);
      mockConsultationRepo.findById.mockResolvedValue(consultation);
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([]);

      await expect(
        service.autoAssign("consult-123", {}, "triage-officer-1"),
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getVetAvailabilityList()", () => {
    it("should return summary list of vets with active caseload", async () => {
      mockVetProfileRepo.findAllActiveVetsWithProfiles.mockResolvedValue([mockVet1]);
      mockConsultationRepo.countActiveConsultationsByVet.mockResolvedValue(2);

      const result = await service.getVetAvailabilityList();

      expect(result).toHaveLength(1);
      expect(result[0]?.vetId).toBe("vet-1");
      expect(result[0]?.currentActiveCases).toBe(2);
      expect(result[0]?.maxActiveCases).toBe(5);
      expect(result[0]?.capacityUtilizationPercent).toBe(40);
    });
  });

  describe("updateVetProfile()", () => {
    it("should allow a vet to update their own profile", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "vet-1",
        role: UserRole.VET,
      });
      mockVetProfileRepo.findByUserId.mockResolvedValue(mockVet1.profile);
      mockVetProfileRepo.save.mockResolvedValue(mockVet1.profile);

      const result = await service.updateVetProfile(
        "vet-1",
        { isAvailable: false },
        "vet-1",
        UserRole.VET,
      );

      expect(mockVetProfileRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe("vet-1");
    });

    it("should allow an admin to update a vet profile", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "vet-1",
        role: UserRole.VET,
      });
      mockVetProfileRepo.findByUserId.mockResolvedValue(mockVet1.profile);
      mockVetProfileRepo.save.mockResolvedValue(mockVet1.profile);

      const result = await service.updateVetProfile(
        "vet-1",
        { isAvailable: true, maxActiveCases: 10 },
        "admin-user",
        UserRole.ADMIN,
      );

      expect(mockVetProfileRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe("vet-1");
    });

    it("should throw ForbiddenOperationException if another user attempts to update", async () => {
      await expect(
        service.updateVetProfile(
          "vet-1",
          { isAvailable: false },
          "other-vet-2",
          UserRole.VET,
        ),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });
});
