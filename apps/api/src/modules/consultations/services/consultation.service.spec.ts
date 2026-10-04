import {
  ConsultationStatus,
  ConsultationType,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { ConsultationService } from "./consultation.service";

describe("ConsultationService", () => {
  let service: ConsultationService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;

  const mockDbRecord = {
    id: "consult-123",
    farmerId: "farmer-1",
    vetId: null,
    farmId: "farm-1",
    animalId: "animal-1",
    chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
    mediaUrls: ["https://s3.amazonaws.com/image.jpg"],
    type: ConsultationType.ASYNC_TICKET,
    status: ConsultationStatus.SUBMITTED,
    roomSessionId: null,
    feeCents: 0,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T10:00:00Z"),
    farmer: { id: "farmer-1", name: "John Doe", email: "john@farm.com" },
    vet: null,
    animal: {
      id: "animal-1",
      name: "Daisy",
      tagNumber: "COW-001",
      species: "COW",
    },
    farm: { id: "farm-1", name: "Green Pastures" },
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

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    } as any;

    mockPrisma = {
      animal: {
        findFirst: jest.fn(),
      },
    };

    service = new ConsultationService(
      mockConsultationRepo,
      mockAuditLogRepo,
      mockPrisma as unknown as PrismaService,
    );
  });

  describe("createConsultation()", () => {
    it("should successfully create a consultation request and emit an audit log", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.create.mockResolvedValue(entity);

      const result = await service.createConsultation(
        "farmer-1",
        {
          farmId: "farm-1",
          chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
          mediaUrls: ["https://s3.amazonaws.com/image.jpg"],
          type: ConsultationType.ASYNC_TICKET,
        },
        "trace-123",
      );

      expect(mockConsultationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          farmerId: "farmer-1",
          farmId: "farm-1",
          status: ConsultationStatus.SUBMITTED,
        }),
      );
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "farmer-1",
          action: "CONSULTATION_REQUEST_SUBMITTED",
          entityType: "Consultation",
          traceId: "trace-123",
        }),
      );
      expect(result.id).toBe("consult-123");
      expect(result.status).toBe(ConsultationStatus.SUBMITTED);
    });

    it("should verify animal exists on target farm if animalId is provided", async () => {
      mockPrisma.animal.findFirst.mockResolvedValue({
        id: "animal-1",
        farmId: "farm-1",
      });
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.create.mockResolvedValue(entity);

      const result = await service.createConsultation("farmer-1", {
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
      });

      expect(mockPrisma.animal.findFirst).toHaveBeenCalledWith({
        where: {
          id: "animal-1",
          farmId: "farm-1",
          deletedAt: null,
        },
      });
      expect(result.id).toBe("consult-123");
    });

    it("should throw NotFoundDomainException if animalId does not exist on farm", async () => {
      mockPrisma.animal.findFirst.mockResolvedValue(null);

      await expect(
        service.createConsultation("farmer-1", {
          farmId: "farm-1",
          animalId: "animal-non-existent",
          chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
        }),
      ).rejects.toThrow(EntityNotFoundException);

      expect(mockConsultationRepo.create).not.toHaveBeenCalled();
    });

    it("should throw ValidationDomainException if farmId is missing", async () => {
      await expect(
        service.createConsultation("farmer-1", {
          farmId: "",
          chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
        }),
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getConsultationById()", () => {
    it("should return consultation response DTO when found", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.findById.mockResolvedValue(entity);

      const result = await service.getConsultationById(
        "consult-123",
        "farm-1",
        "farmer-1",
      );

      expect(mockConsultationRepo.findById).toHaveBeenCalledWith(
        "consult-123",
        "farm-1",
      );
      expect(result.id).toBe("consult-123");
      expect(result.farmer?.name).toBe("John Doe");
    });

    it("should throw EntityNotFoundException when consultation is not found", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.getConsultationById("non-existent", "farm-1", "farmer-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getFarmerConsultations()", () => {
    it("should return paginated consultations list and total count", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.findByFarm.mockResolvedValue({
        items: [entity],
        total: 1,
      });

      const result = await service.getFarmerConsultations(
        "farmer-1",
        "farm-1",
        { page: 1, limit: 10 },
      );

      expect(mockConsultationRepo.findByFarm).toHaveBeenCalledWith(
        "farm-1",
        { page: 1, limit: 10 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getTriageQueue()", () => {
    it("should return paginated triage queue items with computed wait times", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.findTriageQueue.mockResolvedValue({
        items: [entity],
        total: 1,
      });

      const result = await service.getTriageQueue({
        page: 1,
        limit: 20,
        status: ConsultationStatus.SUBMITTED,
      });

      expect(mockConsultationRepo.findTriageQueue).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: ConsultationStatus.SUBMITTED,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(typeof result.items[0]?.waitTimeMinutes).toBe("number");
      expect(result.items[0]?.id).toBe("consult-123");
    });
  });

  describe("getTriageMetrics()", () => {
    it("should return aggregated metrics from repository", async () => {
      const mockMetrics = {
        pendingCount: 5,
        assignedCount: 2,
        inProgressCount: 1,
        completedTodayCount: 4,
        cancelledTodayCount: 0,
        typeBreakdown: { asyncTickets: 4, liveVideos: 4 },
        speciesBreakdown: { COW: 3, GOAT: 2 },
        avgWaitTimeMinutes: 45,
        oldestPendingWaitMinutes: 90,
      };

      mockConsultationRepo.getTriageMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getTriageMetrics();

      expect(mockConsultationRepo.getTriageMetrics).toHaveBeenCalled();
      expect(result).toEqual(mockMetrics);
    });
  });

  describe("getTriageCaseDetail()", () => {
    it("should return detailed case view when found", async () => {
      const mockDetail = {
        ...mockDbRecord,
        createdAt: mockDbRecord.createdAt.toISOString(),
        updatedAt: mockDbRecord.updatedAt.toISOString(),
        waitTimeMinutes: 30,
        farmerPhone: "+1234567890",
        farmType: "DAIRY",
        animalDetails: null,
        recentHealthRecords: [],
        recentVaccineRecords: [],
      };

      mockConsultationRepo.findTriageCaseDetail.mockResolvedValue(mockDetail as any);

      const result = await service.getTriageCaseDetail("consult-123");

      expect(mockConsultationRepo.findTriageCaseDetail).toHaveBeenCalledWith("consult-123");
      expect(result.id).toBe("consult-123");
      expect(result.farmerPhone).toBe("+1234567890");
    });

    it("should throw EntityNotFoundException if case detail is not found", async () => {
      mockConsultationRepo.findTriageCaseDetail.mockResolvedValue(null);

      await expect(service.getTriageCaseDetail("non-existent")).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe("cancelTriageCase()", () => {
    it("should cancel consultation and record audit log", async () => {
      const entity = ConsultationEntity.fromPersistence(mockDbRecord);
      mockConsultationRepo.findById.mockResolvedValue(entity);

      const cancelledEntity = ConsultationEntity.fromPersistence({
        ...mockDbRecord,
        status: ConsultationStatus.CANCELLED,
      });
      mockConsultationRepo.save.mockResolvedValue(cancelledEntity);

      const result = await service.cancelTriageCase(
        "consult-123",
        "Duplicate request submitted by farmer",
        "triage-vet-1",
        "trace-abc",
      );

      expect(mockConsultationRepo.findById).toHaveBeenCalledWith("consult-123");
      expect(mockConsultationRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "triage-vet-1",
          action: "CONSULTATION_CANCELLED_BY_TRIAGE",
          entityType: "Consultation",
          entityId: "consult-123",
          oldValues: { status: ConsultationStatus.SUBMITTED },
          newValues: {
            status: ConsultationStatus.CANCELLED,
            reason: "Duplicate request submitted by farmer",
          },
          traceId: "trace-abc",
        }),
      );
      expect(result.status).toBe(ConsultationStatus.CANCELLED);
    });

    it("should throw ValidationDomainException if cancellation reason is too short", async () => {
      await expect(
        service.cancelTriageCase("consult-123", "no", "triage-vet-1"),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.cancelTriageCase("non-existent", "Valid cancellation reason", "triage-vet-1"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if consultation is already completed", async () => {
      const entity = ConsultationEntity.fromPersistence({
        ...mockDbRecord,
        status: ConsultationStatus.COMPLETED,
      });
      mockConsultationRepo.findById.mockResolvedValue(entity);

      await expect(
        service.cancelTriageCase("consult-123", "Valid cancellation reason", "triage-vet-1"),
      ).rejects.toThrow(ValidationDomainException);
    });
  });
});
