import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { IConsultationService } from "../services/consultation.service.interface";
import { IVetAssignmentService } from "../services/vet-assignment.service.interface";
import { ConsultationTriageController } from "./consultation-triage.controller";

describe("ConsultationTriageController", () => {
  let controller: ConsultationTriageController;
  let mockConsultationService: jest.Mocked<IConsultationService>;
  let mockVetAssignmentService: jest.Mocked<IVetAssignmentService>;

  const mockUser = {
    sub: "user-vet-1",
    email: "vet@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockQueueItem = {
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
    paymentStatus: ConsultationPaymentStatus.UNPAID,
    paymentIntentId: null,
    paymentHeldAt: null,
    paymentCapturedAt: null,
    paymentReleasedAt: null,
    currency: "USD",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    waitTimeMinutes: 25,
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
    mockConsultationService = {
      createConsultation: jest.fn(),
      getConsultationById: jest.fn(),
      getFarmerConsultations: jest.fn(),
      getTriageQueue: jest.fn(),
      getTriageMetrics: jest.fn(),
      getTriageCaseDetail: jest.fn(),
      cancelTriageCase: jest.fn(),
    };

    mockVetAssignmentService = {
      getRankedCandidates: jest.fn(),
      assignToVet: jest.fn(),
      autoAssign: jest.fn(),
      getVetAvailabilityList: jest.fn(),
      getVetProfile: jest.fn(),
      updateVetProfile: jest.fn(),
    };

    controller = new ConsultationTriageController(
      mockConsultationService,
      mockVetAssignmentService,
    );
  });

  describe("getTriageQueue()", () => {
    it("should return paginated triage queue items", async () => {
      mockConsultationService.getTriageQueue.mockResolvedValue({
        items: [mockQueueItem],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await controller.getTriageQueue({
        page: 1,
        limit: 20,
        status: ConsultationStatus.SUBMITTED,
      });

      expect(mockConsultationService.getTriageQueue).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: ConsultationStatus.SUBMITTED,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe("consult-123");
    });
  });

  describe("getTriageMetrics()", () => {
    it("should return dashboard triage metrics", async () => {
      const mockMetrics = {
        pendingCount: 4,
        assignedCount: 2,
        inProgressCount: 1,
        completedTodayCount: 5,
        cancelledTodayCount: 1,
        typeBreakdown: { asyncTickets: 4, liveVideos: 3 },
        speciesBreakdown: { COW: 3, GOAT: 1 },
        avgWaitTimeMinutes: 35,
        oldestPendingWaitMinutes: 65,
      };

      mockConsultationService.getTriageMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getTriageMetrics();

      expect(mockConsultationService.getTriageMetrics).toHaveBeenCalled();
      expect(result).toEqual(mockMetrics);
    });
  });

  describe("getTriageCaseDetail()", () => {
    it("should return detailed case information with animal EHR", async () => {
      const mockDetail = {
        ...mockQueueItem,
        farmerPhone: "+1234567890",
        farmType: "DAIRY",
        animalDetails: null,
        recentHealthRecords: [],
        recentVaccineRecords: [],
      };

      mockConsultationService.getTriageCaseDetail.mockResolvedValue(mockDetail);

      const result = await controller.getTriageCaseDetail("consult-123");

      expect(mockConsultationService.getTriageCaseDetail).toHaveBeenCalledWith("consult-123");
      expect(result.id).toBe("consult-123");
      expect(result.farmerPhone).toBe("+1234567890");
    });
  });

  describe("cancelTriageCase()", () => {
    it("should cancel case and return updated consultation", async () => {
      const mockResponse = {
        ...mockQueueItem,
        status: ConsultationStatus.CANCELLED,
      };

      mockConsultationService.cancelTriageCase.mockResolvedValue(mockResponse);

      const result = await controller.cancelTriageCase(
        "consult-123",
        { reason: "Duplicate case submitted" },
        mockUser,
      );

      expect(mockConsultationService.cancelTriageCase).toHaveBeenCalledWith(
        "consult-123",
        "Duplicate case submitted",
        "user-vet-1",
        "user-user-vet-1",
      );
      expect(result.status).toBe(ConsultationStatus.CANCELLED);
    });
  });

  describe("getCandidates()", () => {
    it("should return ranked candidate list", async () => {
      const mockCandidates = [
        {
          vetId: "vet-1",
          name: "Dr. Alice",
          email: "alice@vet.com",
          avatarUrl: null,
          specialties: ["COW"],
          isAvailable: true,
          currentActiveCases: 1,
          maxActiveCases: 5,
          totalScore: 90,
          scoreBreakdown: {
            specialtyScore: 50,
            workloadScore: 24,
            availabilityScore: 16,
          },
          isEligible: true,
        },
      ];

      mockVetAssignmentService.getRankedCandidates.mockResolvedValue(mockCandidates);

      const result = await controller.getCandidates("consult-123");

      expect(mockVetAssignmentService.getRankedCandidates).toHaveBeenCalledWith("consult-123");
      expect(result).toHaveLength(1);
      expect(result[0]?.vetId).toBe("vet-1");
    });
  });

  describe("assignToVet()", () => {
    it("should manually assign consultation to vet", async () => {
      const mockResponse = {
        ...mockQueueItem,
        vetId: "vet-1",
        status: ConsultationStatus.ASSIGNED,
      };

      mockVetAssignmentService.assignToVet.mockResolvedValue(mockResponse);

      const result = await controller.assignToVet(
        "consult-123",
        { vetId: "vet-1", notes: "Urgent check" },
        mockUser,
      );

      expect(mockVetAssignmentService.assignToVet).toHaveBeenCalledWith(
        "consult-123",
        { vetId: "vet-1", notes: "Urgent check" },
        "user-vet-1",
        "user-user-vet-1",
      );
      expect(result.status).toBe(ConsultationStatus.ASSIGNED);
    });
  });

  describe("autoAssign()", () => {
    it("should auto-assign consultation to highest ranked vet", async () => {
      const mockResponse = {
        ...mockQueueItem,
        vetId: "vet-1",
        status: ConsultationStatus.ASSIGNED,
      };

      mockVetAssignmentService.autoAssign.mockResolvedValue(mockResponse);

      const result = await controller.autoAssign(
        "consult-123",
        {},
        mockUser,
      );

      expect(mockVetAssignmentService.autoAssign).toHaveBeenCalledWith(
        "consult-123",
        {},
        "user-vet-1",
        "user-user-vet-1",
      );
      expect(result.status).toBe(ConsultationStatus.ASSIGNED);
    });
  });
});
