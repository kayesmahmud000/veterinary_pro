import { ClinicalNoteCategory } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { ConsultationClinicalNoteEntity } from "./consultation-clinical-note.entity";

describe("ConsultationClinicalNoteEntity", () => {
  describe("create", () => {
    it("should throw ValidationDomainException if consultationId is empty", () => {
      expect(() =>
        ConsultationClinicalNoteEntity.create({
          consultationId: "",
          authorVetId: "vet-1",
          title: "Differential Diagnosis",
          content: "Possible bovine respiratory syncytial virus.",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if authorVetId is empty", () => {
      expect(() =>
        ConsultationClinicalNoteEntity.create({
          consultationId: "c-1",
          authorVetId: "  ",
          title: "Differential Diagnosis",
          content: "Possible bovine respiratory syncytial virus.",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if title is empty", () => {
      expect(() =>
        ConsultationClinicalNoteEntity.create({
          consultationId: "c-1",
          authorVetId: "vet-1",
          title: "   ",
          content: "Possible bovine respiratory syncytial virus.",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if title exceeds 200 chars", () => {
      expect(() =>
        ConsultationClinicalNoteEntity.create({
          consultationId: "c-1",
          authorVetId: "vet-1",
          title: "A".repeat(201),
          content: "Possible bovine respiratory syncytial virus.",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if content is empty", () => {
      expect(() =>
        ConsultationClinicalNoteEntity.create({
          consultationId: "c-1",
          authorVetId: "vet-1",
          title: "Differential Diagnosis",
          content: "   ",
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should create valid entity with defaults", () => {
      const entity = ConsultationClinicalNoteEntity.create({
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "Initial Differential Diagnosis",
        content: "Suspected acute pneumonia vs BRSV.",
        authorVetName: "Dr. Veterinarian",
      });

      expect(entity.id).toBeDefined();
      expect(entity.consultationId).toBe("c-1");
      expect(entity.authorVetId).toBe("vet-1");
      expect(entity.title).toBe("Initial Differential Diagnosis");
      expect(entity.content).toBe("Suspected acute pneumonia vs BRSV.");
      expect(entity.category).toBe(ClinicalNoteCategory.GENERAL);
      expect(entity.isConfidential).toBe(true);
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.authorVetName).toBe("Dr. Veterinarian");
    });
  });

  describe("update", () => {
    it("should update title, content, category, isConfidential and refresh updatedAt", () => {
      const entity = ConsultationClinicalNoteEntity.create({
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "Initial Note",
        content: "Draft observations",
        category: ClinicalNoteCategory.INTERNAL_OBSERVATION,
      });

      const initialUpdatedAt = entity.updatedAt;

      entity.update({
        title: "Updated SOAP Assessment",
        content: "Assessment: Patient responding well to initial broad-spectrum antibiotic.",
        category: ClinicalNoteCategory.SOAP_NOTE,
        isConfidential: true,
      });

      expect(entity.title).toBe("Updated SOAP Assessment");
      expect(entity.content).toBe(
        "Assessment: Patient responding well to initial broad-spectrum antibiotic.",
      );
      expect(entity.category).toBe(ClinicalNoteCategory.SOAP_NOTE);
      expect(entity.isConfidential).toBe(true);
      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime(),
      );
    });

    it("should throw ValidationDomainException if updated title is empty or too long", () => {
      const entity = ConsultationClinicalNoteEntity.create({
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "Initial Note",
        content: "Draft observations",
      });

      expect(() => entity.update({ title: "  " })).toThrow(
        ValidationDomainException,
      );
      expect(() => entity.update({ title: "X".repeat(205) })).toThrow(
        ValidationDomainException,
      );
    });

    it("should throw ValidationDomainException if updated content is empty", () => {
      const entity = ConsultationClinicalNoteEntity.create({
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "Initial Note",
        content: "Draft observations",
      });

      expect(() => entity.update({ content: "  " })).toThrow(
        ValidationDomainException,
      );
    });
  });

  describe("fromPersistence & toDto", () => {
    it("should correctly reconstruct entity from persistence and serialize to DTO", () => {
      const raw = {
        id: "note-123",
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "SOAP Assessment",
        content: "Plan: Re-check in 48 hours.",
        category: "SOAP_NOTE",
        isConfidential: true,
        createdAt: "2026-09-20T10:00:00.000Z",
        updatedAt: "2026-09-20T10:30:00.000Z",
        authorVet: {
          id: "vet-1",
          name: "Dr. Alice Vet",
          role: "VET",
        },
      };

      const entity = ConsultationClinicalNoteEntity.fromPersistence(raw);

      expect(entity.id).toBe("note-123");
      expect(entity.authorVetName).toBe("Dr. Alice Vet");
      expect(entity.category).toBe(ClinicalNoteCategory.SOAP_NOTE);

      const dto = entity.toDto();
      expect(dto.id).toBe("note-123");
      expect(dto.authorVetName).toBe("Dr. Alice Vet");
      expect(dto.title).toBe("SOAP Assessment");
      expect(dto.category).toBe(ClinicalNoteCategory.SOAP_NOTE);
      expect(dto.isConfidential).toBe(true);
      expect(dto.createdAt).toBe("2026-09-20T10:00:00.000Z");
    });
  });
});
