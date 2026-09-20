import { ClinicalNoteCategory, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationClinicalNoteEntity } from "../entities/consultation-clinical-note.entity";
import { ConsultationClinicalNoteRepository } from "./consultation-clinical-note.repository";

describe("ConsultationClinicalNoteRepository", () => {
  let repository: ConsultationClinicalNoteRepository;
  let mockPrisma: any;

  const sampleDbRecord = {
    id: "note-1",
    consultationId: "c-1",
    authorVetId: "vet-1",
    title: "SOAP Note",
    content: "Patient stable.",
    category: "SOAP_NOTE",
    isConfidential: true,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T10:00:00.000Z"),
    authorVet: {
      id: "vet-1",
      name: "Dr. Veterinarian",
      role: UserRole.VET,
    },
  };

  beforeEach(() => {
    mockPrisma = {
      consultationClinicalNote: {
        create: jest.fn().mockResolvedValue(sampleDbRecord),
        findUnique: jest.fn().mockResolvedValue(sampleDbRecord),
        findMany: jest.fn().mockResolvedValue([sampleDbRecord]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(sampleDbRecord),
        delete: jest.fn().mockResolvedValue(sampleDbRecord),
      },
    };

    repository = new ConsultationClinicalNoteRepository(
      mockPrisma as PrismaService,
    );
  });

  describe("create", () => {
    it("should persist clinical note and return domain entity", async () => {
      const entity = ConsultationClinicalNoteEntity.create({
        consultationId: "c-1",
        authorVetId: "vet-1",
        title: "SOAP Note",
        content: "Patient stable.",
        category: ClinicalNoteCategory.SOAP_NOTE,
      });

      const result = await repository.create(entity);

      expect(result).toBeDefined();
      expect(result.id).toBe("note-1");
      expect(mockPrisma.consultationClinicalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consultationId: "c-1",
            authorVetId: "vet-1",
            title: "SOAP Note",
            category: ClinicalNoteCategory.SOAP_NOTE,
          }),
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return null if note not found", async () => {
      mockPrisma.consultationClinicalNote.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");
      expect(result).toBeNull();
    });

    it("should return entity if note found", async () => {
      const result = await repository.findById("note-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("note-1");
      expect(result?.authorVetName).toBe("Dr. Veterinarian");
    });
  });

  describe("findByConsultation", () => {
    it("should return paginated list and total count", async () => {
      const result = await repository.findByConsultation(
        "c-1",
        ClinicalNoteCategory.SOAP_NOTE,
        1,
        20,
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.consultationClinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            consultationId: "c-1",
            category: ClinicalNoteCategory.SOAP_NOTE,
          },
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe("update", () => {
    it("should update and return updated domain entity", async () => {
      const entity = ConsultationClinicalNoteEntity.fromPersistence(sampleDbRecord);
      entity.update({ title: "Updated Title" });

      const result = await repository.update(entity);

      expect(result).toBeDefined();
      expect(mockPrisma.consultationClinicalNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "note-1" },
          data: expect.objectContaining({
            title: "Updated Title",
          }),
        }),
      );
    });
  });

  describe("delete", () => {
    it("should delete clinical note record", async () => {
      const result = await repository.delete("note-1");

      expect(result).toBe(true);
      expect(mockPrisma.consultationClinicalNote.delete).toHaveBeenCalledWith({
        where: { id: "note-1" },
      });
    });
  });
});
