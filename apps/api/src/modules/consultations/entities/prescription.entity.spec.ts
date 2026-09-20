import {
  MedicationFormulation,
  MedicationRoute,
  PrescriptionStatus,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { PrescriptionEntity } from "./prescription.entity";

describe("PrescriptionEntity", () => {
  const validMedication = {
    name: "Oxytetracycline 200mg/ml",
    formulation: MedicationFormulation.INJECTABLE,
    route: MedicationRoute.INTRAMUSCULAR,
    dosage: "20 mg/kg",
    frequency: "Once daily",
    durationDays: 5,
    withdrawalDays: 21,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    instructions: "Deep intramuscular injection in neck region.",
  };

  describe("create", () => {
    it("should throw ValidationDomainException if consultationId is empty", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "",
          vetId: "vet-1",
          diagnosis: "Bovine Respiratory Disease Complex",
          medications: [validMedication],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if vetId is empty", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "  ",
          diagnosis: "Bovine Respiratory Disease Complex",
          medications: [validMedication],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if diagnosis is empty", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "   ",
          medications: [validMedication],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if diagnosis exceeds 500 characters", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "D".repeat(501),
          medications: [validMedication],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if medications array is empty", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if medication name is missing", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, name: "  " }],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if medication dosage is missing", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, dosage: "" }],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if medication frequency is missing", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, frequency: " " }],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if durationDays is less than 1", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, durationDays: 0 }],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if withdrawal days are negative", () => {
      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, withdrawalDaysMilk: -1 }],
        }),
      ).toThrow(ValidationDomainException);

      expect(() =>
        PrescriptionEntity.create({
          consultationId: "c-1",
          vetId: "vet-1",
          diagnosis: "Acute Mastitis",
          medications: [{ ...validMedication, withdrawalDaysMeat: -5 }],
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should create valid prescription entity in DRAFT status", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Bovine Respiratory Disease Complex",
        notes: "Monitor body temperature every 12 hours.",
        medications: [validMedication],
        vetName: "Dr. Veterinarian",
      });

      expect(entity.id).toBeDefined();
      expect(entity.consultationId).toBe("c-1");
      expect(entity.vetId).toBe("vet-1");
      expect(entity.diagnosis).toBe("Bovine Respiratory Disease Complex");
      expect(entity.notes).toBe("Monitor body temperature every 12 hours.");
      expect(entity.status).toBe(PrescriptionStatus.DRAFT);
      expect(entity.medications).toHaveLength(1);
      expect(entity.withdrawalDays).toBe(21);
      expect(entity.pdfS3Key).toBeNull();
      expect(entity.digitalSignatureHash).toBeNull();
      expect(entity.signedAt).toBeNull();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.vetName).toBe("Dr. Veterinarian");
    });
  });

  describe("update", () => {
    it("should update diagnosis, notes, medications and withdrawalDays", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      const updatedMedication = {
        ...validMedication,
        name: "Penicillin G Procaine",
        withdrawalDays: 10,
        withdrawalDaysMilk: 5,
        withdrawalDaysMeat: 10,
      };

      entity.update({
        diagnosis: "Confirmed Acute Mastitis",
        notes: "Intramammary infusions prescribed.",
        medications: [updatedMedication],
      });

      expect(entity.diagnosis).toBe("Confirmed Acute Mastitis");
      expect(entity.notes).toBe("Intramammary infusions prescribed.");
      expect(entity.medications[0].name).toBe("Penicillin G Procaine");
      expect(entity.withdrawalDays).toBe(10);
    });

    it("should throw ValidationDomainException if prescription is already SIGNED", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.sign({
        pdfS3Key: "prescriptions/c-1.pdf",
        digitalSignatureHash: "hash-12345",
      });

      expect(() =>
        entity.update({
          diagnosis: "Cannot change signed prescription",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if prescription is REVOKED", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.revoke("Revocation reason");

      expect(() =>
        entity.update({
          diagnosis: "Cannot change revoked prescription",
        }),
      ).toThrow(ValidationDomainException);
    });
  });

  describe("sign and revoke", () => {
    it("should sign prescription successfully using object", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.sign({
        pdfS3Key: "prescriptions/c-1.pdf",
        digitalSignatureHash: "signature-hash-xyz",
      });

      expect(entity.status).toBe(PrescriptionStatus.SIGNED);
      expect(entity.pdfS3Key).toBe("prescriptions/c-1.pdf");
      expect(entity.digitalSignatureHash).toBe("signature-hash-xyz");
      expect(entity.signedAt).toBeInstanceOf(Date);
    });

    it("should sign prescription successfully using string arguments", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.sign("signature-hash-direct", "prescriptions/c-1-direct.pdf");

      expect(entity.status).toBe(PrescriptionStatus.SIGNED);
      expect(entity.pdfS3Key).toBe("prescriptions/c-1-direct.pdf");
      expect(entity.digitalSignatureHash).toBe("signature-hash-direct");
      expect(entity.signedAt).toBeInstanceOf(Date);
    });

    it("should throw if signing an already signed prescription", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.sign({
        pdfS3Key: "prescriptions/c-1.pdf",
        digitalSignatureHash: "signature-hash-xyz",
      });

      expect(() =>
        entity.sign({
          pdfS3Key: "prescriptions/c-1.pdf",
          digitalSignatureHash: "signature-hash-xyz",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should revoke prescription and record reason in notes", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        notes: "Original notes.",
        medications: [validMedication],
      });

      entity.revoke("Incorrect dosage entered.");

      expect(entity.status).toBe(PrescriptionStatus.REVOKED);
      expect(entity.notes).toContain("REVOKED: Incorrect dosage entered.");
    });

    it("should throw if revoking an already revoked prescription", () => {
      const entity = PrescriptionEntity.create({
        consultationId: "c-1",
        vetId: "vet-1",
        diagnosis: "Initial Diagnosis",
        medications: [validMedication],
      });

      entity.revoke();

      expect(() => entity.revoke()).toThrow(ValidationDomainException);
    });
  });

  describe("fromPersistence and toDto", () => {
    it("should reconstruct from persistence and serialize to DTO", () => {
      const raw = {
        id: "presc-100",
        consultationId: "c-100",
        vetId: "vet-1",
        diagnosis: "Parasitic Bronchitis",
        notes: "Keep in quarantine.",
        medications: [validMedication],
        withdrawalDays: 28,
        pdfS3Key: "s3://bucket/presc.pdf",
        digitalSignatureHash: "sha256-hash",
        status: "SIGNED",
        signedAt: new Date("2026-09-20T12:00:00.000Z"),
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        updatedAt: new Date("2026-09-20T12:00:00.000Z"),
        vet: {
          id: "vet-1",
          name: "Dr. Alice Vet",
        },
      };

      const entity = PrescriptionEntity.fromPersistence(raw);
      expect(entity.id).toBe("presc-100");
      expect(entity.vetId).toBe("vet-1");
      expect(entity.vetName).toBe("Dr. Alice Vet");
      expect(entity.status).toBe(PrescriptionStatus.SIGNED);
      expect(entity.withdrawalDays).toBe(21);

      const dto = entity.toDto();
      expect(dto.id).toBe("presc-100");
      expect(dto.consultationId).toBe("c-100");
      expect(dto.vetId).toBe("vet-1");
      expect(dto.vetName).toBe("Dr. Alice Vet");
      expect(dto.diagnosis).toBe("Parasitic Bronchitis");
      expect(dto.notes).toBe("Keep in quarantine.");
      expect(dto.medications).toHaveLength(1);
      expect(dto.medications[0].name).toBe("Oxytetracycline 200mg/ml");
      expect(dto.withdrawalDays).toBe(21);
      expect(dto.status).toBe(PrescriptionStatus.SIGNED);
      expect(dto.pdfS3Key).toBe("s3://bucket/presc.pdf");
      expect(dto.digitalSignatureHash).toBe("sha256-hash");
      expect(dto.signedAt).toBe("2026-09-20T12:00:00.000Z");
      expect(dto.createdAt).toBe("2026-09-20T10:00:00.000Z");
      expect(dto.updatedAt).toBe("2026-09-20T12:00:00.000Z");
    });
  });
});
