import {
  ClinicalNoteCategory,
  ClinicalNoteDto,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { IConsultationClinicalNoteService } from "../services/consultation-clinical-note.service.interface";
import { ConsultationClinicalNotesController } from "./consultation-clinical-notes.controller";

describe("ConsultationClinicalNotesController", () => {
  let controller: ConsultationClinicalNotesController;
  let mockService: jest.Mocked<IConsultationClinicalNoteService>;

  const mockVetUser: JwtPayload = {
    sub: "vet-123",
    email: "vet@clinic.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const sampleNoteDto: ClinicalNoteDto = {
    id: "note-1",
    consultationId: "c-123",
    authorVetId: "vet-123",
    authorVetName: "Dr. Veterinarian",
    title: "SOAP Assessment",
    content: "Plan: Administer fluids.",
    category: ClinicalNoteCategory.SOAP_NOTE,
    isConfidential: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockService = {
      createNote: jest.fn(),
      getNotesByConsultation: jest.fn(),
      getNoteById: jest.fn(),
      updateNote: jest.fn(),
      deleteNote: jest.fn(),
    };

    controller = new ConsultationClinicalNotesController(mockService);
  });

  describe("createNote", () => {
    it("should call service.createNote and return created note", async () => {
      mockService.createNote.mockResolvedValue(sampleNoteDto);

      const result = await controller.createNote(
        "c-123",
        mockVetUser,
        {
          title: "SOAP Assessment",
          content: "Plan: Administer fluids.",
          category: ClinicalNoteCategory.SOAP_NOTE,
        },
      );

      expect(result).toEqual(sampleNoteDto);
      expect(mockService.createNote).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        {
          title: "SOAP Assessment",
          content: "Plan: Administer fluids.",
          category: ClinicalNoteCategory.SOAP_NOTE,
        },
        "user-vet-123",
      );
    });
  });

  describe("getNotes", () => {
    it("should call service.getNotesByConsultation and return paginated list", async () => {
      const mockResult = {
        items: [sampleNoteDto],
        total: 1,
        page: 1,
        limit: 50,
      };
      mockService.getNotesByConsultation.mockResolvedValue(mockResult);

      const result = await controller.getNotes("c-123", mockVetUser, {
        page: 1,
        limit: 50,
      });

      expect(result).toEqual(mockResult);
      expect(mockService.getNotesByConsultation).toHaveBeenCalledWith(
        "c-123",
        mockVetUser,
        { page: 1, limit: 50 },
      );
    });
  });

  describe("getNoteById", () => {
    it("should call service.getNoteById and return note", async () => {
      mockService.getNoteById.mockResolvedValue(sampleNoteDto);

      const result = await controller.getNoteById(
        "c-123",
        "note-1",
        mockVetUser,
      );

      expect(result).toEqual(sampleNoteDto);
      expect(mockService.getNoteById).toHaveBeenCalledWith(
        "c-123",
        "note-1",
        mockVetUser,
      );
    });
  });

  describe("updateNote", () => {
    it("should call service.updateNote and return updated note", async () => {
      const updatedDto = { ...sampleNoteDto, title: "Updated Title" };
      mockService.updateNote.mockResolvedValue(updatedDto);

      const result = await controller.updateNote(
        "c-123",
        "note-1",
        mockVetUser,
        { title: "Updated Title" },
      );

      expect(result).toEqual(updatedDto);
      expect(mockService.updateNote).toHaveBeenCalledWith(
        "c-123",
        "note-1",
        mockVetUser,
        { title: "Updated Title" },
        "user-vet-123",
      );
    });
  });

  describe("deleteNote", () => {
    it("should call service.deleteNote", async () => {
      mockService.deleteNote.mockResolvedValue(undefined);

      await controller.deleteNote("c-123", "note-1", mockVetUser);

      expect(mockService.deleteNote).toHaveBeenCalledWith(
        "c-123",
        "note-1",
        mockVetUser,
        "user-vet-123",
      );
    });
  });
});
