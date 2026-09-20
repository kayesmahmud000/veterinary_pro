import {
  JwtPayload,
  MedicationFormulation,
  MedicationRoute,
  PrescriptionDto,
  PrescriptionStatus,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { IPrescriptionService } from "../services/prescription.service.interface";
import { PrescriptionsController } from "./prescriptions.controller";

describe("PrescriptionsController", () => {
  let controller: PrescriptionsController;
  let mockService: jest.Mocked<IPrescriptionService>;

  const mockVetUser: JwtPayload = {
    sub: "vet-123",
    email: "vet@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const samplePrescriptionDto: PrescriptionDto = {
    id: "presc-1",
    consultationId: "c-123",
    vetId: "vet-123",
    vetName: "Dr. Veterinarian",
    diagnosis: "Bovine Respiratory Disease Complex",
    notes: "Rest and hydration.",
    medications: [
      {
        name: "Oxytetracycline 200mg/ml",
        formulation: MedicationFormulation.INJECTABLE,
        route: MedicationRoute.INTRAMUSCULAR,
        dosage: "20 mg/kg",
        frequency: "Once daily",
        durationDays: 5,
        withdrawalDaysMilk: 7,
        withdrawalDaysMeat: 21,
        instructions: "Deep IM injection.",
      },
    ],
    withdrawalDays: 21,
    pdfS3Key: null,
    digitalSignatureHash: null,
    status: PrescriptionStatus.DRAFT,
    signedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockService = {
      createPrescription: jest.fn(),
      getPrescription: jest.fn(),
      updatePrescription: jest.fn(),
      signPrescription: jest.fn(),
      verifyPrescriptionSignature: jest.fn(),
      getPrescriptionPdf: jest.fn(),
      publicVerifyPrescription: jest.fn(),
    };

    controller = new PrescriptionsController(mockService);
  });

  describe("createPrescription", () => {
    it("should call service.createPrescription and return created prescription", async () => {
      mockService.createPrescription.mockResolvedValue(samplePrescriptionDto);

      const result = await controller.createPrescription(
        "c-123",
        mockVetUser,
        {
          diagnosis: "Bovine Respiratory Disease Complex",
          notes: "Rest and hydration.",
          medications: samplePrescriptionDto.medications,
        },
      );

      expect(result).toEqual(samplePrescriptionDto);
      expect(mockService.createPrescription).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        {
          diagnosis: "Bovine Respiratory Disease Complex",
          notes: "Rest and hydration.",
          medications: samplePrescriptionDto.medications,
        },
        "user-vet-123",
      );
    });
  });

  describe("getPrescription", () => {
    it("should call service.getPrescription and return prescription", async () => {
      mockService.getPrescription.mockResolvedValue(samplePrescriptionDto);

      const result = await controller.getPrescription("c-123", mockVetUser);

      expect(result).toEqual(samplePrescriptionDto);
      expect(mockService.getPrescription).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
      );
    });

    it("should return null if service returns null (e.g. farmer viewing draft)", async () => {
      mockService.getPrescription.mockResolvedValue(null);

      const result = await controller.getPrescription("c-123", mockVetUser);

      expect(result).toBeNull();
    });
  });

  describe("updatePrescription", () => {
    it("should call service.updatePrescription and return updated prescription", async () => {
      const updatedDto = {
        ...samplePrescriptionDto,
        diagnosis: "Updated Diagnosis",
      };
      mockService.updatePrescription.mockResolvedValue(updatedDto);

      const result = await controller.updatePrescription(
        "c-123",
        mockVetUser,
        {
          diagnosis: "Updated Diagnosis",
        },
      );

      expect(result).toEqual(updatedDto);
      expect(mockService.updatePrescription).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        { diagnosis: "Updated Diagnosis" },
        "user-vet-123",
      );
    });
  });

  describe("signPrescription", () => {
    it("should call service.signPrescription and return signed prescription", async () => {
      const signedDto: PrescriptionDto = {
        ...samplePrescriptionDto,
        status: PrescriptionStatus.SIGNED,
        digitalSignatureHash: "rsa-sig-123",
        signedAt: new Date().toISOString(),
      };
      mockService.signPrescription.mockResolvedValue(signedDto);

      const result = await controller.signPrescription("c-123", mockVetUser, {
        licenseNumber: "LIC-12345",
      });

      expect(result).toEqual(signedDto);
      expect(mockService.signPrescription).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        { licenseNumber: "LIC-12345" },
        "user-vet-123",
      );
    });
  });

  describe("verifyPrescriptionSignature", () => {
    it("should call service.verifyPrescriptionSignature and return verification result", async () => {
      const verificationResult = {
        isValid: true,
        algorithm: "RSA-SHA256",
        prescriptionHash: "sha256-hash-abc",
        signedAt: new Date().toISOString(),
        signerVetName: "Dr. Veterinarian",
        signerLicenseNumber: "LIC-12345",
      };
      mockService.verifyPrescriptionSignature.mockResolvedValue(
        verificationResult,
      );

      const result = await controller.verifyPrescriptionSignature("c-123");

      expect(result).toEqual(verificationResult);
      expect(mockService.verifyPrescriptionSignature).toHaveBeenCalledWith(
        "c-123",
      );
    });
  });

  describe("getPrescriptionPdf", () => {
    it("should call service.getPrescriptionPdf and stream response with headers", async () => {
      const mockBuffer = Buffer.from("%PDF-mock");
      mockService.getPrescriptionPdf.mockResolvedValue({
        buffer: mockBuffer,
        fileName: "prescription-c-123.pdf",
        s3Key: "prescriptions/c-123/p.pdf",
      });

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
      } as any;

      await controller.getPrescriptionPdf("c-123", mockVetUser, mockRes);

      expect(mockService.getPrescriptionPdf).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="prescription-c-123.pdf"',
        "Content-Length": mockBuffer.length,
      });
      expect(mockRes.end).toHaveBeenCalledWith(mockBuffer);
    });
  });
});

