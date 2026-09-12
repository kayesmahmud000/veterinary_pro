import {
  AnimalSpecies,
  AnimalStatus,
  TagBadgeLayout,
  TagBadgePageSize,
} from "../../enums/index.js";

export interface AnimalQrCodeDto {
  animalId: string;
  farmId: string;
  tagNumber: string;
  qrCodeDataUrl: string;
  payload: string;
}

export interface BatchTagBadgeRequestDto {
  animalIds?: string[];
  species?: AnimalSpecies;
  status?: AnimalStatus;
  layout?: TagBadgeLayout;
  pageSize?: TagBadgePageSize;
  includePedigree?: boolean;
}
