import {
  ConsultationPaymentStatus,
  ConsultationResponseDto,
  ConsultationStatus,
  ConsultationType,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { ConsultationController } from "./consultation.controller";
import { IConsultationService } from "./services/consultation.service.interface";

describe("ConsultationController", () => {
  let controller: ConsultationController;
  let mockConsultationService: jest.Mocked<IConsultationService>;

  const mockUser: JwtPayload = {
    sub: "farmer-1",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockResponse: ConsultationResponseDto = {
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

    controller = new ConsultationController(mockConsultationService);
  });

  describe("createConsultation()", () => {
    it("should submit a consultation request and return response DTO", async () => {
      mockConsultationService.createConsultation.mockResolvedValue(mockResponse);

      const dto = {
        farmId: "farm-1",
        animalId: "animal-1",
        chiefComplaint: "Cow showing signs of acute respiratory distress and high fever.",
        mediaUrls: ["https://s3.amazonaws.com/image.jpg"],
        type: ConsultationType.ASYNC_TICKET,
      };

      const result = await controller.createConsultation(
        mockUser,
        "farm-1",
        dto,
      );

      expect(mockConsultationService.createConsultation).toHaveBeenCalledWith(
        mockUser.sub,
        expect.objectContaining({
          farmId: "farm-1",
          animalId: "animal-1",
        }),
        `user-${mockUser.sub}`,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getConsultations()", () => {
    it("should return paginated consultations for a farm", async () => {
      mockConsultationService.getFarmerConsultations.mockResolvedValue({
        items: [mockResponse],
        total: 1,
      });

      const query = { page: 1, limit: 10 };
      const result = await controller.getConsultations(
        mockUser,
        "farm-1",
        query,
      );

      expect(mockConsultationService.getFarmerConsultations).toHaveBeenCalledWith(
        mockUser.sub,
        "farm-1",
        query,
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getConsultationById()", () => {
    it("should return consultation details for an ID", async () => {
      mockConsultationService.getConsultationById.mockResolvedValue(mockResponse);

      const result = await controller.getConsultationById(
        "consult-123",
        "farm-1",
        mockUser,
      );

      expect(mockConsultationService.getConsultationById).toHaveBeenCalledWith(
        "consult-123",
        "farm-1",
        mockUser.sub,
        mockUser.role,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
