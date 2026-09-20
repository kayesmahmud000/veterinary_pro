import {
  ClinicalNoteDto,
  CreateClinicalNoteDto,
  JwtPayload,
  QueryClinicalNotesDto,
  UpdateClinicalNoteDto,
} from "@vetralink/shared-types";

export const CONSULTATION_CLINICAL_NOTE_SERVICE = Symbol(
  "CONSULTATION_CLINICAL_NOTE_SERVICE",
);

export interface IConsultationClinicalNoteService {
  createNote(
    consultationId: string,
    author: JwtPayload,
    dto: CreateClinicalNoteDto,
    traceId?: string,
  ): Promise<ClinicalNoteDto>;

  getNotesByConsultation(
    consultationId: string,
    requestingUser: JwtPayload,
    query: QueryClinicalNotesDto,
  ): Promise<{
    items: ClinicalNoteDto[];
    total: number;
    page: number;
    limit: number;
  }>;

  getNoteById(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
  ): Promise<ClinicalNoteDto>;

  updateNote(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
    dto: UpdateClinicalNoteDto,
    traceId?: string,
  ): Promise<ClinicalNoteDto>;

  deleteNote(
    consultationId: string,
    noteId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<void>;
}
