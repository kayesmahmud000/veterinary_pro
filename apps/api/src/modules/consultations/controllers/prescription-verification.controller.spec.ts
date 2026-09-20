import { PrescriptionStatus } from "@vetralink/shared-types";
import { IPrescriptionService } from "../services/prescription.service.interface";
import { PrescriptionVerificationController } from "./prescription-verification.controller";

describe("PrescriptionVerificationController", () => {
  let controller: PrescriptionVerificationController;
  let mockPrescriptionService: jest.Mocked<IPrescriptionService>;

  const mockVerificationResult = {
    isValid: true,
    status: PrescriptionStatus.SIGNED,
    algorithm: "RSA-SHA256",
    prescriptionHash: "mock-sha256-hash",
    signedAt: new Date().toISOString(),
    consultationId: "c-123",
    prescriptionId: "p-456",
    clinicName: "VetraLink Pro Clinical Telehealth",
    attendingVet: {
      name: "Dr. Veterinarian",
      licenseNumber: "VET-LIC-12345",
    },
    farm: {
      name: "Sunny Hills Farm",
    },
    animal: {
      species: "Bovine",
      tagNumber: "COW-101",
      name: "Bella",
    },
    diagnosis: "Acute Bronchopneumonia",
    medications: [
      {
        name: "Oxytetracycline",
        formulation: "INJECTABLE",
        route: "INTRAMUSCULAR",
        dosage: "20 mg/kg",
        frequency: "Once daily",
        durationDays: 5,
        withdrawalDays: 21,
      },
    ],
    withdrawalSummary: {
      hasActiveWithdrawal: true,
      maxWithdrawalDays: 21,
      milkWithdrawalDays: 7,
      meatWithdrawalDays: 21,
      safeHarvestDate: new Date(Date.now() + 21 * 86400000).toISOString(),
    },
    verifiedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockPrescriptionService = {
      createPrescription: jest.fn(),
      getPrescription: jest.fn(),
      updatePrescription: jest.fn(),
      signPrescription: jest.fn(),
      verifyPrescriptionSignature: jest.fn(),
      getPrescriptionPdf: jest.fn(),
      publicVerifyPrescription: jest
        .fn()
        .mockResolvedValue(mockVerificationResult),
    };

    controller = new PrescriptionVerificationController(
      mockPrescriptionService,
    );
  });

  describe("verifyPrescription", () => {
    it("should call service.publicVerifyPrescription and return verification DTO", async () => {
      const result = await controller.verifyPrescription("c-123");

      expect(result).toEqual(mockVerificationResult);
      expect(
        mockPrescriptionService.publicVerifyPrescription,
      ).toHaveBeenCalledWith("c-123");
    });
  });
});
