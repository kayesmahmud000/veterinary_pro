import {
  MedicationFormulation,
  MedicationRoute,
  PrescriptionStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PrescriptionEntity } from "../entities/prescription.entity";
import { PrescriptionRepository } from "./prescription.repository";

describe("PrescriptionRepository", () => {
  let repository: PrescriptionRepository;
  let mockPrisma: any;

  const sampleMedication = {
    name: "Oxytetracycline 200mg/ml",
    formulation: MedicationFormulation.INJECTABLE,
    route: MedicationRoute.INTRAMUSCULAR,
    dosage: "20 mg/kg",
    frequency: "Once daily",
    durationDays: 5,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    instructions: "Deep IM injection.",
  };

  const sampleDbRecord = {
    id: "presc-1",
    consultationId: "c-1",
    diagnosis: "Bovine Respiratory Disease Complex",
    notes: "Keep warm and dry.",
    medications: [sampleMedication],
    withdrawalDays: 21,
    pdfS3Key: null,
    digitalSignatureHash: null,
    status: PrescriptionStatus.DRAFT,
    signedAt: null,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T10:00:00.000Z"),
  };

  beforeEach(() => {
    mockPrisma = {
      prescription: {
        create: jest.fn().mockResolvedValue(sampleDbRecord),
        findUnique: jest.fn().mockResolvedValue(sampleDbRecord),
        update: jest.fn().mockResolvedValue(sampleDbRecord),
      },
    };

    repository = new PrescriptionRepository(mockPrisma as PrismaService);
  });

  describe("create", () => {
    it("should persist prescription and return domain entity", async () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Bovine Respiratory Disease Complex",
        notes: "Keep warm and dry.",
        medications: [sampleMedication],
      });

      const result = await repository.create(entity);

      expect(result).toBeDefined();
      expect(result.id).toBe("presc-1");
      expect(mockPrisma.prescription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          consultationId: "c-1",
          diagnosis: "Bovine Respiratory Disease Complex",
          status: PrescriptionStatus.DRAFT,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe("findById", () => {
    it("should return null if prescription not found", async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });

    it("should return entity if prescription found", async () => {
      const result = await repository.findById("presc-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("presc-1");
      expect(result?.consultationId).toBe("c-1");
      expect(result?.diagnosis).toBe("Bovine Respiratory Disease Complex");
      expect(mockPrisma.prescription.findUnique).toHaveBeenCalledWith({
        where: { id: "presc-1" },
        include: expect.any(Object),
      });
    });
  });

  describe("findByConsultationId", () => {
    it("should return null if no prescription for consultation", async () => {
      mockPrisma.prescription.findUnique.mockResolvedValue(null);

      const result = await repository.findByConsultationId("non-existent-c");
      expect(result).toBeNull();
    });

    it("should return entity if prescription found by consultationId", async () => {
      const result = await repository.findByConsultationId("c-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("presc-1");
      expect(mockPrisma.prescription.findUnique).toHaveBeenCalledWith({
        where: { consultationId: "c-1" },
        include: expect.any(Object),
      });
    });
  });

  describe("save", () => {
    it("should update prescription in DB and return entity", async () => {
      const entity = PrescriptionEntity.fromPersistence(sampleDbRecord);
      entity.update({ diagnosis: "Updated Diagnosis" });

      const updatedRecord = { ...sampleDbRecord, diagnosis: "Updated Diagnosis" };
      mockPrisma.prescription.update.mockResolvedValue(updatedRecord);

      const result = await repository.save(entity);

      expect(result.diagnosis).toBe("Updated Diagnosis");
      expect(mockPrisma.prescription.update).toHaveBeenCalledWith({
        where: { id: "presc-1" },
        data: expect.objectContaining({
          diagnosis: "Updated Diagnosis",
        }),
        include: expect.any(Object),
      });
    });
  });
});
