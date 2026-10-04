import {
  AnimalSpecies,
  FarmWithdrawalAlertsDto,
  FoodSafetyRiskLevel,
  FoodSafetyWithdrawalStatusDto,
  JwtPayload,
  UserRole,
  UserStatus,
  WithdrawalAlertDispatchResultDto,
} from "@vetralink/shared-types";
import { IFoodSafetyService } from "../services/food-safety.service.interface";
import { FoodSafetyController } from "./food-safety.controller";

describe("FoodSafetyController", () => {
  let controller: FoodSafetyController;
  let mockService: jest.Mocked<IFoodSafetyService>;

  const mockVetUser: JwtPayload = {
    sub: "vet-123",
    email: "vet@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const sampleStatusDto: FoodSafetyWithdrawalStatusDto = {
    animalId: "animal-1",
    animalTag: "COW-101",
    species: AnimalSpecies.COW,
    farmId: "farm-1",
    consultationId: "c-123",
    prescriptionId: "presc-1",
    riskLevel: FoodSafetyRiskLevel.CRITICAL_BOTH,
    isMilkWithdrawn: true,
    isMeatWithdrawn: true,
    milkWithdrawalEndsAt: "2026-10-02T00:00:00.000Z",
    meatWithdrawalEndsAt: "2026-10-16T00:00:00.000Z",
    milkDaysRemaining: 10,
    meatDaysRemaining: 24,
    activeMedications: [],
    warningMessage: "Warning",
  };

  const sampleFarmAlertsDto: FarmWithdrawalAlertsDto = {
    farmId: "farm-1",
    totalAnimalsUnderWithdrawal: 1,
    animalsWithMilkWithdrawal: 1,
    animalsWithMeatWithdrawal: 1,
    alerts: [sampleStatusDto],
  };

  const sampleDispatchResult: WithdrawalAlertDispatchResultDto = {
    consultationId: "c-123",
    animalId: "animal-1",
    farmerId: "farmer-1",
    riskLevel: FoodSafetyRiskLevel.CRITICAL_BOTH,
    notificationsSent: {
      push: true,
      sms: true,
      email: true,
    },
    dispatchedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockService = {
      getConsultationWithdrawalStatus: jest.fn(),
      getAnimalWithdrawalStatus: jest.fn(),
      getFarmWithdrawalAlerts: jest.fn(),
      dispatchWithdrawalAlert: jest.fn(),
    };

    controller = new FoodSafetyController(mockService);
  });

  describe("getConsultationWithdrawalStatus", () => {
    it("should call service.getConsultationWithdrawalStatus and return status", async () => {
      mockService.getConsultationWithdrawalStatus.mockResolvedValue(
        sampleStatusDto,
      );

      const result = await controller.getConsultationWithdrawalStatus(
        "c-123",
        mockVetUser,
      );

      expect(result).toEqual(sampleStatusDto);
      expect(mockService.getConsultationWithdrawalStatus).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
      );
    });
  });

  describe("getAnimalWithdrawalStatus", () => {
    it("should call service.getAnimalWithdrawalStatus and return status", async () => {
      mockService.getAnimalWithdrawalStatus.mockResolvedValue(sampleStatusDto);

      const result = await controller.getAnimalWithdrawalStatus(
        "animal-1",
        mockVetUser,
      );

      expect(result).toEqual(sampleStatusDto);
      expect(mockService.getAnimalWithdrawalStatus).toHaveBeenCalledWith(
        "animal-1",
        mockVetUser,
      );
    });
  });

  describe("getFarmWithdrawalAlerts", () => {
    it("should call service.getFarmWithdrawalAlerts and return farm alerts", async () => {
      mockService.getFarmWithdrawalAlerts.mockResolvedValue(sampleFarmAlertsDto);

      const result = await controller.getFarmWithdrawalAlerts(
        "farm-1",
        mockVetUser,
      );

      expect(result).toEqual(sampleFarmAlertsDto);
      expect(mockService.getFarmWithdrawalAlerts).toHaveBeenCalledWith(
        "farm-1",
        mockVetUser,
      );
    });
  });

  describe("dispatchWithdrawalAlert", () => {
    it("should call service.dispatchWithdrawalAlert and return dispatch result", async () => {
      mockService.dispatchWithdrawalAlert.mockResolvedValue(sampleDispatchResult);

      const result = await controller.dispatchWithdrawalAlert(
        "c-123",
        mockVetUser,
      );

      expect(result).toEqual(sampleDispatchResult);
      expect(mockService.dispatchWithdrawalAlert).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        "user-vet-123",
      );
    });
  });
});
