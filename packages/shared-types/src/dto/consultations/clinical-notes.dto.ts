import { ClinicalNoteCategory } from "../../enums";

export interface ClinicalNoteDto {
  id: string;
  consultationId: string;
  authorVetId: string;
  authorVetName: string;
  title: string;
  content: string;
  category: ClinicalNoteCategory;
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicalNoteDto {
  title: string;
  content: string;
  category?: ClinicalNoteCategory;
  isConfidential?: boolean;
}

export interface UpdateClinicalNoteDto {
  title?: string;
  content?: string;
  category?: ClinicalNoteCategory;
  isConfidential?: boolean;
}

export interface QueryClinicalNotesDto {
  category?: ClinicalNoteCategory;
  page?: number;
  limit?: number;
}
