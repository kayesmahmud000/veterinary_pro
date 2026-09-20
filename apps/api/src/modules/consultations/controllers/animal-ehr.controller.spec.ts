import { AnimalSpecies, UserRole } from "@vetralink/shared-types";
import { IAnimalEhrService } from "../services/animal-ehr.service.interface";
import { AnimalEhrController } from "./animal-ehr.controller";

describe("AnimalEhrController", () => {
  let controller: AnimalEhrController;
  let mockEhrService: jest.Mocked<IAnimalEhrService>;

  const mockEhrResponse = {
    animal: {
      id: "animal-1",
      farmId: "farm-1",
      tagNumber: "COW-001",
      rfidNumber: null,
      name: "Bella",
      species: AnimalSpecies.COW,
      breed: "Holstein",
      gender: "FEMALE" as any,
      dateOfBirth: "2024-01-01",
      ageFormatted: "2 years",
      weightKg: 550,
      status: "ACTIVE" as any,
      farm: {
        id: "farm-1",
        name: "Test Farm",
        farmType: "DAIRY",
        country: "USA",
      },
    },
    highlights: {
      totalHealthIncidents: 2,
      activeUnresolvedIncidents: 1,
      totalVaccinationsAdministered: 3,
      overduePreventativeCount: 0,
      activeWithdrawalAlertsCount: 1,
      lifetimeMedicalCostCents: 15000,
      lastWeightKg: 550,
      lastYieldLiters: 25.4,
    },
    activeWithdrawalAlerts: [],
    clinicalIncidents: [],
    preventativeRecords: [],
    weightHistory: [],
    consultationHistory: [],
    prescriptionHistory: [],
  };

  const mockVetUser = {
    sub: "vet-1",
    email: "alice@vet.com",
    role: UserRole.VET,
  };

  beforeEach(() => {
    mockEhrService = {
      getConsultationEhr: jest.fn().mockResolvedValue(mockEhrResponse),
      getAnimalEhr: jest.fn().mockResolvedValue(mockEhrResponse),
    };

    controller = new AnimalEhrController(mockEhrService);
  });

  describe("getConsultationEhr", () => {
    it("should retrieve consultation EHR through service", async () => {
      const result = await controller.getConsultationEhr(
        "consult-123",
        mockVetUser as any,
      );

      expect(result).toEqual(mockEhrResponse);
      expect(mockEhrService.getConsultationEhr).toHaveBeenCalledWith(
        "consult-123",
        mockVetUser,
        "user-vet-1",
      );
    });
  });

  describe("getAnimalEhr", () => {
    it("should retrieve animal EHR directly through service", async () => {
      const result = await controller.getAnimalEhr(
        "animal-1",
        mockVetUser as any,
      );

      expect(result).toEqual(mockEhrResponse);
      expect(mockEhrService.getAnimalEhr).toHaveBeenCalledWith(
        "animal-1",
        mockVetUser,
        "user-vet-1",
      );
    });
  });
});
