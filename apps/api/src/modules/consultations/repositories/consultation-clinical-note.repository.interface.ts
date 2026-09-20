import { Prisma } from "@prisma/client";
import { ClinicalNoteCategory } from "@vetralink/shared-types";
import { ConsultationClinicalNoteEntity } from "../entities/consultation-clinical-note.entity";

export const CONSULTATION_CLINICAL_NOTE_REPOSITORY = Symbol(
  "CONSULTATION_CLINICAL_NOTE_REPOSITORY",
);

export interface IConsultationClinicalNoteRepository {
  create(
    entity: ConsultationClinicalNoteEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationClinicalNoteEntity>;

  findById(id: string): Promise<ConsultationClinicalNoteEntity | null>;

  findByConsultation(
    consultationId: string,
    category?: ClinicalNoteCategory,
    page?: number,
    limit?: number,
  ): Promise<{ items: ConsultationClinicalNoteEntity[]; total: number }>;

  update(
    entity: ConsultationClinicalNoteEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationClinicalNoteEntity>;

  delete(id: string, tx?: Prisma.TransactionClient): Promise<boolean>;
}
