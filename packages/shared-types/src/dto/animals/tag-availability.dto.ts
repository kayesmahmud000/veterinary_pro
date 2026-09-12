export interface CheckTagAvailabilityDto {
  readonly tagNumber?: string;
  readonly rfidNumber?: string | null;
  readonly excludeAnimalId?: string;
}

export interface TagAvailabilityItemDto {
  readonly value: string;
  readonly isAvailable: boolean;
  readonly conflictingAnimalId?: string;
}

export interface TagAvailabilityResponseDto {
  readonly tagNumber?: TagAvailabilityItemDto;
  readonly rfidNumber?: TagAvailabilityItemDto;
}
