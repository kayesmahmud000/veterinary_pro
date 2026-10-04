import {
  HealthEventType,
  JwtPayload,
  MedicationFormulation,
  MedicationRoute,
  PrescriptionStatus,
  SeverityLevel,
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
import { PrescriptionEntity } from "../entities/prescription.entity";
import { IPrescriptionRepository } from "../repositories/prescription.repository.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { PrescriptionService } from "./prescription.service";

describe("PrescriptionService", () => {
  let service: PrescriptionService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockPrescriptionRepo: jest.Mocked<IPrescriptionRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockPrisma: any;

  const mockAssignedVet: JwtPayload = {
    sub: "vet-assigned-1",
    email: "vet1@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockOtherVet: JwtPayload = {
    sub: "vet-other-2",
    email: "vet2@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockAdminUser: JwtPayload = {
    sub: "admin-1",
    email: "admin@clinic.com",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockFarmerUser: JwtPayload = {
    sub: "farmer-1",
    email: "farmer@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockOtherFarmer: JwtPayload = {
    sub: "farmer-other-99",
    email: "stranger@farm.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const sampleMedication = {
    name: "Oxytetracycline 200mg/ml",
    formulation: MedicationFormulation.INJECTABLE,
    route: MedicationRoute.INTRAMUSCULAR,
    dosage: "20 mg/kg",
    frequency: "Once daily",
    durationDays: 5,
    withdrawalDays: 21,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    instructions: "Deep IM injection in neck area.",
  };

  const createSampleConsultation = () => {
    return ConsultationEntity.fromPersistence({
      id: "consult-1",
      farmerId: "farmer-1",
      vetId: "vet-assigned-1",
      farmId: "farm-1",
      animalId: "animal-1",
      chiefComplaint: "Cow with acute cough and fever.",
      mediaUrls: [],
      type: "LIVE_VIDEO" as any,
      status: "IN_PROGRESS" as any,
      roomSessionId: "room-1",
      feeCents: 3000,
      paymentStatus: "AUTHORIZED" as any,
      paymentIntentId: "pi_123",
      paymentHeldAt: new Date(),
      paymentCapturedAt: null,
      paymentReleasedAt: null,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    mockConsultationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByFarm: jest.fn(),
      findByFarmer: jest.fn(),
      findTriageQueue: jest.fn(),
      findTriageCaseDetail: jest.fn(),
      getTriageMetrics: jest.fn(),
      countActiveConsultationsByVet: jest.fn(),
      findConflictingConsultations: jest.fn(),
    };

    mockPrescriptionRepo = {
      create: jest.fn().mockImplementation(async (entity) => entity),
      findById: jest.fn(),
      findByConsultationId: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: "Dr. Assigned Vet" }),
      },
      farmMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      healthRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: "mock-health-record-uuid",
          ...data,
        })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({
          id: where.id,
          ...data,
        })),
      },
    };

    const mockVetProfileRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        userId: "vet-assigned-1",
        licenseNumber: "VET-LIC-12345",
        update: jest.fn(),
      }),
      save: jest.fn().mockImplementation(async (e) => e),
      findAllActiveVetsWithProfiles: jest.fn().mockResolvedValue([]),
    };

    const mockPkiCryptoService = {
      canonicalize: jest.fn().mockReturnValue('{"canonical":"data"}'),
      hash: jest.fn().mockReturnValue("mock-sha256-hash-64chars"),
      sign: jest.fn().mockReturnValue("mock-rsa-signature-base64"),
      verify: jest.fn().mockReturnValue(true),
      getPublicKey: jest.fn().mockReturnValue("-----BEGIN PUBLIC KEY-----"),
    };

    const mockPrescriptionPdfService = {
      generatePrescriptionPdf: jest
        .fn()
        .mockResolvedValue(Buffer.from("%PDF-1.7-mock-content")),
    };

    const mockS3StorageService = {
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
      getPresignedGetUrl: jest
        .fn()
        .mockResolvedValue("https://s3.download.url"),
    };

    const mockEnvService = {
      s3BucketMedia: "test-media-bucket",
      corsOrigins: ["https://app.vetralink.com"],
    };

    service = new PrescriptionService(
      mockConsultationRepo,
      mockPrescriptionRepo,
      mockVetProfileRepo as any,
      mockPkiCryptoService as any,
      mockPrescriptionPdfService as any,
      mockS3StorageService as any,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
      mockEnvService as any,
    );
  });

  describe("createPrescription", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.createPrescription("non-existent", mockAssignedVet, {
          diagnosis: "Bovine Respiratory Disease",
          medications: [sampleMedication],
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if user is a farmer", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      await expect(
        service.createPrescription("consult-1", mockFarmerUser, {
          diagnosis: "Bovine Respiratory Disease",
          medications: [sampleMedication],
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ForbiddenOperationException if vet is not assigned to the consultation", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      await expect(
        service.createPrescription("consult-1", mockOtherVet, {
          diagnosis: "Bovine Respiratory Disease",
          medications: [sampleMedication],
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if prescription already exists for consultation", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(
        PrescriptionEntity.create({
          consultationId: "consult-1",
          vetId: "vet-assigned-1",
          diagnosis: "Existing Diagnosis",
          medications: [sampleMedication],
        }),
      );

      await expect(
        service.createPrescription("consult-1", mockAssignedVet, {
          diagnosis: "Duplicate Prescription",
          medications: [sampleMedication],
        }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should allow assigned vet to create draft prescription and record audit log", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);

      const result = await service.createPrescription(
        "consult-1",
        mockAssignedVet,
        {
          diagnosis: "Bovine Respiratory Disease Complex",
          notes: "Keep in warm pen.",
          medications: [sampleMedication],
        },
        "trace-create",
      );

      expect(result).toBeDefined();
      expect(result.consultationId).toBe("consult-1");
      expect(result.status).toBe(PrescriptionStatus.DRAFT);
      expect(result.diagnosis).toBe("Bovine Respiratory Disease Complex");
      expect(result.withdrawalDays).toBe(21);
      expect(mockPrescriptionRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_DRAFTED",
          userId: mockAssignedVet.sub,
          traceId: "trace-create",
        }),
      );
    });

    it("should allow admin to create prescription", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);

      const result = await service.createPrescription(
        "consult-1",
        mockAdminUser,
        {
          diagnosis: "Clinical Director Override",
          medications: [sampleMedication],
        },
      );

      expect(result.diagnosis).toBe("Clinical Director Override");
      expect(mockPrescriptionRepo.create).toHaveBeenCalled();
    });
  });

  describe("getPrescription", () => {
    it("should throw ForbiddenOperationException if requesting user is unrelated", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      await expect(
        service.getPrescription("consult-1", mockOtherFarmer),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should return null for farmer if prescription is still in DRAFT status", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(
        PrescriptionEntity.create({
          consultationId: "consult-1",
          vetId: "vet-assigned-1",
          diagnosis: "Draft Diagnosis",
          medications: [sampleMedication],
        }),
      );

      const result = await service.getPrescription("consult-1", mockFarmerUser);
      expect(result).toBeNull();
    });

    it("should return prescription for farmer if prescription is SIGNED", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const signedPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Signed Diagnosis",
        medications: [sampleMedication],
      });
      signedPresc.sign({
        pdfS3Key: "prescriptions/consult-1.pdf",
        digitalSignatureHash: "hash-xyz",
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signedPresc);

      const result = await service.getPrescription("consult-1", mockFarmerUser);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(PrescriptionStatus.SIGNED);
      expect(result?.diagnosis).toBe("Signed Diagnosis");
    });

    it("should return draft prescription for assigned vet", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(
        PrescriptionEntity.create({
          consultationId: "consult-1",
          vetId: "vet-assigned-1",
          diagnosis: "Draft Diagnosis",
          medications: [sampleMedication],
        }),
      );

      const result = await service.getPrescription("consult-1", mockAssignedVet);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(PrescriptionStatus.DRAFT);
    });
  });

  describe("updatePrescription", () => {
    it("should throw ForbiddenOperationException if unassigned vet tries to update", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      await expect(
        service.updatePrescription("consult-1", mockOtherVet, {
          diagnosis: "Unauthorized update",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw EntityNotFoundException if prescription does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);

      await expect(
        service.updatePrescription("consult-1", mockAssignedVet, {
          diagnosis: "Update attempt",
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if prescription is already SIGNED", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const signedPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Signed Diagnosis",
        medications: [sampleMedication],
      });
      signedPresc.sign({
        pdfS3Key: "s3://pdf",
        digitalSignatureHash: "hash",
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signedPresc);

      await expect(
        service.updatePrescription("consult-1", mockAssignedVet, {
          diagnosis: "Try update signed",
        }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should update draft prescription and record audit log", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Original Diagnosis",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);

      const result = await service.updatePrescription(
        "consult-1",
        mockAssignedVet,
        {
          diagnosis: "Refined Diagnosis",
          notes: "Updated instructions.",
        },
        "trace-update",
      );

      expect(result.diagnosis).toBe("Refined Diagnosis");
      expect(result.notes).toBe("Updated instructions.");
      expect(mockPrescriptionRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_UPDATED",
          userId: mockAssignedVet.sub,
          traceId: "trace-update",
        }),
      );
    });
  });

  describe("signPrescription", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.signPrescription("non-existent", mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if unassigned vet tries to sign", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      await expect(
        service.signPrescription("consult-1", mockOtherVet),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw EntityNotFoundException if prescription does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);

      await expect(
        service.signPrescription("consult-1", mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if prescription is already SIGNED", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const signedPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Signed Diagnosis",
        medications: [sampleMedication],
      });
      signedPresc.sign("mock-signature");
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signedPresc);

      await expect(
        service.signPrescription("consult-1", mockAssignedVet),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should sign draft prescription, update status to SIGNED, append to animal EHR, and emit audit logs", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Acute Bronchopneumonia",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);

      const result = await service.signPrescription(
        "consult-1",
        mockAssignedVet,
        { licenseNumber: "VET-BOARD-9988" },
        "trace-sign-1",
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(PrescriptionStatus.SIGNED);
      expect(result.digitalSignatureHash).toBe("mock-rsa-signature-base64");
      expect(result.signedAt).toBeDefined();
      expect(mockPrescriptionRepo.save).toHaveBeenCalled();

      // Check HealthRecord creation
      expect(mockPrisma.healthRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          farmId: "farm-1",
          animalId: "animal-1",
          recordedById: mockAssignedVet.sub,
          attendingVetId: "vet-assigned-1",
          eventType: HealthEventType.ILLNESS,
          severity: SeverityLevel.MEDIUM,
          symptoms: "Cow with acute cough and fever.",
          diagnosis: "Acute Bronchopneumonia",
          cost: expect.any(Object),
          resolvedAt: null,
        }),
      });

      // Check audit logs (both signing and EHR append)
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_DIGITALLY_SIGNED",
          userId: mockAssignedVet.sub,
          traceId: "trace-sign-1",
        }),
      );
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_EHR_APPENDED",
          userId: mockAssignedVet.sub,
          traceId: "trace-sign-1",
        }),
      );
    });

    it("should update existing HealthRecord when one already exists for this consultation (idempotency)", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Acute Bronchopneumonia",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);
      mockPrisma.healthRecord.findFirst.mockResolvedValue({
        id: "existing-hr-123",
      });

      await service.signPrescription("consult-1", mockAssignedVet);

      expect(mockPrisma.healthRecord.update).toHaveBeenCalledWith({
        where: { id: "existing-hr-123" },
        data: expect.objectContaining({
          diagnosis: "Acute Bronchopneumonia",
          attendingVetId: "vet-assigned-1",
        }),
      });
      expect(mockPrisma.healthRecord.create).not.toHaveBeenCalled();
    });

    it("should skip individual EHR append when consultation has no animalId (herd-level)", async () => {
      const herdConsultation = ConsultationEntity.fromPersistence({
        id: "consult-herd-1",
        farmerId: "farmer-1",
        vetId: "vet-assigned-1",
        farmId: "farm-1",
        animalId: null,
        chiefComplaint: "Whole herd respiratory signs.",
        mediaUrls: [],
        type: "LIVE_VIDEO" as any,
        status: "IN_PROGRESS" as any,
        roomSessionId: "room-1",
        feeCents: 5000,
        paymentStatus: "AUTHORIZED" as any,
        paymentIntentId: "pi_123",
        paymentHeldAt: new Date(),
        paymentCapturedAt: null,
        paymentReleasedAt: null,
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockConsultationRepo.findById.mockResolvedValue(herdConsultation);
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-herd-1",
        vetId: "vet-assigned-1",
        diagnosis: "Herd-level pneumonia",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);

      const result = await service.signPrescription(
        "consult-herd-1",
        mockAssignedVet,
      );

      expect(result.status).toBe(PrescriptionStatus.SIGNED);
      expect(mockPrisma.healthRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.healthRecord.update).not.toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_DIGITALLY_SIGNED",
        }),
      );
      expect(mockAuditLogRepo.record).not.toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PRESCRIPTION_EHR_APPENDED",
        }),
      );
    });
  });

  describe("verifyPrescriptionSignature", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.verifyPrescriptionSignature("non-existent"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if prescription is not in SIGNED status", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Draft Diagnosis",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);

      await expect(
        service.verifyPrescriptionSignature("consult-1"),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should verify digital signature successfully for a signed prescription", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const signedPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Signed Diagnosis",
        medications: [sampleMedication],
      });
      signedPresc.sign("mock-rsa-signature-base64");
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signedPresc);

      const verification =
        await service.verifyPrescriptionSignature("consult-1");

      expect(verification).toBeDefined();
      expect(verification.isValid).toBe(true);
      expect(verification.algorithm).toBe("RSA-SHA256");
      expect(verification.prescriptionHash).toBe("mock-sha256-hash-64chars");
      expect(verification.signerVetName).toBe("Dr. Assigned Vet");
    });
  });

  describe("getPrescriptionPdf", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.getPrescriptionPdf("non-existent", mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if prescription is not yet signed", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const draftPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Draft Diagnosis",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draftPresc);

      await expect(
        service.getPrescriptionPdf("consult-1", mockAssignedVet),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should return generated PDF buffer and fileName for signed prescription", async () => {
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      const signedPresc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Signed Diagnosis",
        medications: [sampleMedication],
      });
      signedPresc.sign("mock-rsa-signature", "prescriptions/consult-1/p.pdf");
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signedPresc);

      const result = await service.getPrescriptionPdf(
        "consult-1",
        mockFarmerUser,
      );

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
      expect(result.fileName).toContain(".pdf");
      expect(result.s3Key).toBe("prescriptions/consult-1/p.pdf");
    });
  });

  describe("publicVerifyPrescription", () => {
    it("should throw EntityNotFoundException if prescription cannot be found by ID", async () => {
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);
      mockPrescriptionRepo.findById.mockResolvedValue(null);

      await expect(
        service.publicVerifyPrescription("unknown-id"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return isValid: false and status: DRAFT for an unsigned prescription", async () => {
      const draft = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Draft Condition",
        medications: [sampleMedication],
      });
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(draft);
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      const result = await service.publicVerifyPrescription("consult-1");

      expect(result.isValid).toBe(false);
      expect(result.status).toBe(PrescriptionStatus.DRAFT);
      expect(result.tamperWarning).toContain("draft status");
    });

    it("should return isValid: false and status: REVOKED for a revoked prescription", async () => {
      const presc = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Revoked Condition",
        medications: [sampleMedication],
      });
      presc.revoke("Prescribed wrong formulation");
      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(presc);
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      const result = await service.publicVerifyPrescription("consult-1");

      expect(result.isValid).toBe(false);
      expect(result.status).toBe(PrescriptionStatus.REVOKED);
      expect(result.tamperWarning).toContain("revoked");
    });

    it("should return isValid: true with withdrawal clearance date for a valid signed prescription", async () => {
      const signed = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Bovine Respiratory Disease",
        medications: [sampleMedication],
      });
      const signDate = new Date("2026-09-20T12:00:00Z");
      signed.sign("mock-signature-hash", undefined, signDate);

      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signed);
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      const result = await service.publicVerifyPrescription("consult-1");

      expect(result.isValid).toBe(true);
      expect(result.status).toBe(PrescriptionStatus.SIGNED);
      expect(result.prescriptionHash).toBe("mock-sha256-hash-64chars");
      expect(result.attendingVet.name).toBe("Dr. Assigned Vet");
      expect(result.withdrawalSummary.hasActiveWithdrawal).toBe(true);
      expect(result.withdrawalSummary.maxWithdrawalDays).toBe(21);
      expect(result.withdrawalSummary.safeHarvestDate).toBeDefined();
      expect(result.tamperWarning).toBeUndefined();
    });

    it("should return isValid: false and warning if signature verification fails (tampered data)", async () => {
      const signed = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Bovine Respiratory Disease",
        medications: [sampleMedication],
      });
      signed.sign("mock-signature-hash");

      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(signed);
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());

      // Simulate verification failure
      (service as any).pkiCryptoService.verify = jest.fn().mockReturnValue(false);

      const result = await service.publicVerifyPrescription("consult-1");

      expect(result.isValid).toBe(false);
      expect(result.tamperWarning).toContain("SECURITY WARNING");
    });

    it("should resolve prescription when queried directly by prescription.id", async () => {
      const signed = PrescriptionEntity.create({
        consultationId: "consult-1",
        vetId: "vet-assigned-1",
        diagnosis: "Bovine Respiratory Disease",
        medications: [sampleMedication],
      });
      signed.sign("mock-signature-hash");

      mockPrescriptionRepo.findByConsultationId.mockResolvedValue(null);
      mockPrescriptionRepo.findById.mockResolvedValue(signed);
      mockConsultationRepo.findById.mockResolvedValue(createSampleConsultation());
      (service as any).pkiCryptoService.verify = jest.fn().mockReturnValue(true);

      const result = await service.publicVerifyPrescription(signed.id);

      expect(result.isValid).toBe(true);
      expect(result.prescriptionId).toBe(signed.id);
      expect(result.consultationId).toBe("consult-1");
    });
  });
});

