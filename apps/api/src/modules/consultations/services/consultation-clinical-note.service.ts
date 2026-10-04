import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ClinicalNoteDto,
  CreateClinicalNoteDto,
  JwtPayload,
  QueryClinicalNotesDto,
  UpdateClinicalNoteDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationClinicalNoteEntity } from "../entities/consultation-clinical-note.entity";
import {
  CONSULTATION_CLINICAL_NOTE_REPOSITORY,
  IConsultationClinicalNoteRepository,
} from "../repositories/consultation-clinical-note.repository.interface";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import { IConsultationClinicalNoteService } from "./consultation-clinical-note.service.interface";

@Injectable()
export class ConsultationClinicalNoteService
  implements IConsultationClinicalNoteService
{
  private readonly logger = new Logger(ConsultationClinicalNoteService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(CONSULTATION_CLINICAL_NOTE_REPOSITORY)
    private readonly noteRepo: IConsultationClinicalNoteRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async createNote(
    consultationId: string,
    author: JwtPayload,
    dto: CreateClinicalNoteDto,
    traceId?: string,
  ): Promise<ClinicalNoteDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorAccess(consultation, author);

    const user = await this.prisma.user.findUnique({
      where: { id: author.sub },
      select: { name: true },
    });

    const entity = ConsultationClinicalNoteEntity.create({
      consultationId,
      authorVetId: author.sub,
      title: dto.title,
      content: dto.content,
      category: dto.category,
      isConfidential: dto.isConfidential,
      authorVetName: user?.name,
    });

    const saved = await this.noteRepo.create(entity);

    await this.auditLogRepo.record({
      userId: author.sub,
      action: "CLINICAL_NOTE_CREATED",
      entityType: "ConsultationClinicalNote",
      entityId: saved.id,
      newValues: {
        consultationId,
        category: saved.category,
        title: saved.title,
        isConfidential: saved.isConfidential,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Clinical note '${saved.id}' created for consultation '${consultationId}' by vet '${author.sub}' (${saved.category})`,
    );

    return saved.toDto();
  }

  public async getNotesByConsultation(
    consultationId: string,
    requestingUser: JwtPayload,
    query: QueryClinicalNotesDto,
  ): Promise<{
    items: ClinicalNoteDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorAccess(consultation, requestingUser);

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;

    const result = await this.noteRepo.findByConsultation(
      consultationId,
      query.category,
      page,
      limit,
    );

    return {
      items: result.items.map((n) => n.toDto()),
      total: result.total,
      page,
      limit,
    };
  }

  public async getNoteById(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
  ): Promise<ClinicalNoteDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorAccess(consultation, requestingUser);

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.consultationId !== consultationId) {
      throw new EntityNotFoundException("ConsultationClinicalNote", noteId);
    }

    return note.toDto();
  }

  public async updateNote(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
    dto: UpdateClinicalNoteDto,
    traceId?: string,
  ): Promise<ClinicalNoteDto> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorAccess(consultation, requestingUser);

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.consultationId !== consultationId) {
      throw new EntityNotFoundException("ConsultationClinicalNote", noteId);
    }

    this.verifyModifyAccess(note, requestingUser);

    note.update(dto);
    const updated = await this.noteRepo.update(note);

    await this.auditLogRepo.record({
      userId: requestingUser.sub,
      action: "CLINICAL_NOTE_UPDATED",
      entityType: "ConsultationClinicalNote",
      entityId: note.id,
      newValues: {
        title: updated.title,
        category: updated.category,
        isConfidential: updated.isConfidential,
        updatedAt: updated.updatedAt.toISOString(),
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Clinical note '${noteId}' updated by user '${requestingUser.sub}' for consultation '${consultationId}'`,
    );

    return updated.toDto();
  }

  public async deleteNote(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<void> {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    this.verifyDoctorAccess(consultation, requestingUser);

    const note = await this.noteRepo.findById(noteId);
    if (!note || note.consultationId !== consultationId) {
      throw new EntityNotFoundException("ConsultationClinicalNote", noteId);
    }

    this.verifyModifyAccess(note, requestingUser);

    await this.noteRepo.delete(noteId);

    await this.auditLogRepo.record({
      userId: requestingUser.sub,
      action: "CLINICAL_NOTE_DELETED",
      entityType: "ConsultationClinicalNote",
      entityId: noteId,
      oldValues: {
        consultationId,
        title: note.title,
        category: note.category,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Clinical note '${noteId}' deleted by user '${requestingUser.sub}' for consultation '${consultationId}'`,
    );
  }

  private verifyDoctorAccess(
    consultation: any,
    requestingUser: JwtPayload,
  ): void {
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAssignedVet =
      requestingUser.role === UserRole.VET &&
      consultation.vetId === requestingUser.sub;

    if (!isSuperOrAdmin && !isAssignedVet) {
      throw new ForbiddenOperationException(
        "Confidential clinical notes are accessible only to the attending veterinarian or administrators.",
      );
    }
  }

  private verifyModifyAccess(
    note: ConsultationClinicalNoteEntity,
    requestingUser: JwtPayload,
  ): void {
    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;
    const isAuthor = note.authorVetId === requestingUser.sub;

    if (!isSuperOrAdmin && !isAuthor) {
      throw new ForbiddenOperationException(
        "Only the author veterinarian or an administrator can modify or delete this clinical note.",
      );
    }
  }
}
