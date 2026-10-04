import {
  ClinicalNoteCategory,
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationClinicalNoteEntity } from "../entities/consultation-clinical-note.entity";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationClinicalNoteRepository } from "../repositories/consultation-clinical-note.repository.interface";
import { IConsultationRepository } from "../repositories/consultation.repository.interface";
import { ConsultationClinicalNoteService } from "./consultation-clinical-note.service";

describe("ConsultationClinicalNoteService", () => {
  let service: ConsultationClinicalNoteService;
  let mockConsultationRepo: jest.Mocked<IConsultationRepository>;
  let mockNoteRepo: jest.Mocked<IConsultationClinicalNoteRepository>;
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

  const createSampleConsultation = (props?: Partial<any>) => {
    return ConsultationEntity.fromPersistence({
      id: "consult-1",
      farmerId: "farmer-1",
      vetId: "vet-assigned-1",
      farmId: "farm-1",
      animalId: "animal-1",
      chiefComplaint: "Cow with fever and respiratory distress.",
      mediaUrls: [],
      type: ConsultationType.LIVE_VIDEO,
      status: ConsultationStatus.IN_PROGRESS,
      roomSessionId: "room-1",
      feeCents: 3000,
      paymentStatus: ConsultationPaymentStatus.AUTHORIZED,
      paymentIntentId: "pi_123",
      paymentHeldAt: new Date(),
      paymentCapturedAt: null,
      paymentReleasedAt: null,
      currency: "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
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

    mockNoteRepo = {
      create: jest.fn().mockImplementation(async (entity) => entity),
      findById: jest.fn(),
      findByConsultation: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      update: jest.fn().mockImplementation(async (entity) => entity),
      delete: jest.fn().mockResolvedValue(true),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: "Dr. Assigned Vet" }),
      },
    };

    service = new ConsultationClinicalNoteService(
      mockConsultationRepo,
      mockNoteRepo,
      mockAuditLogRepo,
      mockPrisma as PrismaService,
    );
  });

  describe("createNote", () => {
    it("should throw EntityNotFoundException if consultation does not exist", async () => {
      mockConsultationRepo.findById.mockResolvedValue(null);

      await expect(
        service.createNote("non-existent", mockAssignedVet, {
          title: "Title",
          content: "Content",
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if user is a farmer", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.createNote("consult-1", mockFarmerUser, {
          title: "Title",
          content: "Content",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ForbiddenOperationException if vet is not assigned to the consultation", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.createNote("consult-1", mockOtherVet, {
          title: "Title",
          content: "Content",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should allow assigned vet to create clinical note and record audit log", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.createNote(
        "consult-1",
        mockAssignedVet,
        {
          title: "SOAP Assessment",
          content: "Plan: Administer oxytetracycline.",
          category: ClinicalNoteCategory.SOAP_NOTE,
        },
        "trace-1",
      );

      expect(result).toBeDefined();
      expect(result.title).toBe("SOAP Assessment");
      expect(result.authorVetId).toBe(mockAssignedVet.sub);
      expect(result.authorVetName).toBe("Dr. Assigned Vet");
      expect(result.category).toBe(ClinicalNoteCategory.SOAP_NOTE);
      expect(mockNoteRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockAssignedVet.sub,
          action: "CLINICAL_NOTE_CREATED",
          traceId: "trace-1",
        }),
      );
    });

    it("should allow admin to create clinical note", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const result = await service.createNote("consult-1", mockAdminUser, {
        title: "Admin Review Note",
        content: "Case reviewed by clinical director.",
      });

      expect(result).toBeDefined();
      expect(mockNoteRepo.create).toHaveBeenCalled();
    });
  });

  describe("getNotesByConsultation", () => {
    it("should throw ForbiddenOperationException if farmer requests notes", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      await expect(
        service.getNotesByConsultation("consult-1", mockFarmerUser, {}),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should return paginated list of clinical notes for attending vet", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const sampleNote = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Observation",
        content: "Normal rumination observed.",
      });

      mockNoteRepo.findByConsultation.mockResolvedValue({
        items: [sampleNote],
        total: 1,
      });

      const result = await service.getNotesByConsultation(
        "consult-1",
        mockAssignedVet,
        { page: 1, limit: 20 },
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].title).toBe("Observation");
    });
  });

  describe("getNoteById", () => {
    it("should throw EntityNotFoundException if note belongs to another consultation", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const foreignNote = ConsultationClinicalNoteEntity.create({
        consultationId: "other-consult-999",
        authorVetId: mockAssignedVet.sub,
        title: "Foreign Note",
        content: "Other case note.",
      });
      mockNoteRepo.findById.mockResolvedValue(foreignNote);

      await expect(
        service.getNoteById("consult-1", foreignNote.id, mockAssignedVet),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return clinical note if valid and authorized", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Diagnosis",
        content: "Acute mastitis.",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      const result = await service.getNoteById(
        "consult-1",
        note.id,
        mockAssignedVet,
      );

      expect(result.title).toBe("Diagnosis");
      expect(result.content).toBe("Acute mastitis.");
    });
  });

  describe("updateNote", () => {
    it("should throw ForbiddenOperationException if another vet tries to update note", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Initial Observation",
        content: "Draft note",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      await expect(
        service.updateNote("consult-1", note.id, mockOtherVet, {
          title: "Unauthorized Edit",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should allow author vet to update note and record audit log", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Initial Observation",
        content: "Draft note",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      const result = await service.updateNote(
        "consult-1",
        note.id,
        mockAssignedVet,
        {
          title: "Finalized SOAP Note",
          content: "Comprehensive plan updated.",
        },
        "trace-update",
      );

      expect(result.title).toBe("Finalized SOAP Note");
      expect(mockNoteRepo.update).toHaveBeenCalled();
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CLINICAL_NOTE_UPDATED",
          userId: mockAssignedVet.sub,
        }),
      );
    });

    it("should allow admin to update note authored by another vet", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Initial Observation",
        content: "Draft note",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      const result = await service.updateNote(
        "consult-1",
        note.id,
        mockAdminUser,
        {
          title: "Admin Edit",
        },
      );

      expect(result.title).toBe("Admin Edit");
      expect(mockNoteRepo.update).toHaveBeenCalled();
    });
  });

  describe("deleteNote", () => {
    it("should throw ForbiddenOperationException if unassigned vet tries to delete", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Note to delete",
        content: "Content",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      await expect(
        service.deleteNote("consult-1", note.id, mockOtherVet),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should delete note and record audit log when author vet requests deletion", async () => {
      const consult = createSampleConsultation();
      mockConsultationRepo.findById.mockResolvedValue(consult);

      const note = ConsultationClinicalNoteEntity.create({
        consultationId: "consult-1",
        authorVetId: mockAssignedVet.sub,
        title: "Note to delete",
        content: "Content",
      });
      mockNoteRepo.findById.mockResolvedValue(note);

      await service.deleteNote(
        "consult-1",
        note.id,
        mockAssignedVet,
        "trace-del",
      );

      expect(mockNoteRepo.delete).toHaveBeenCalledWith(note.id);
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CLINICAL_NOTE_DELETED",
          userId: mockAssignedVet.sub,
          entityId: note.id,
        }),
      );
    });
  });
});
