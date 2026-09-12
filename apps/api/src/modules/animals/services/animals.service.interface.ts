import {
  AnimalQueryFilterDto,
  AnimalResponseDto,
  CheckTagAvailabilityDto,
  PaginatedAnimalsDto,
  RegisterAnimalRequestDto,
  TagAvailabilityResponseDto,
  UpdateAnimalRequestDto,
} from "@vetralink/shared-types";

export interface IAnimalsService {
  registerAnimal(
    farmId: string,
    dto: RegisterAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;

  updateAnimal(
    id: string,
    farmId: string,
    dto: UpdateAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;

  getAnimalById(id: string, farmId: string): Promise<AnimalResponseDto>;

  lookupByIdentifier(
    identifier: string,
    farmId: string
  ): Promise<AnimalResponseDto>;

  checkTagAvailability(
    farmId: string,
    dto: CheckTagAvailabilityDto
  ): Promise<TagAvailabilityResponseDto>;

  getAnimals(
    farmId: string,
    query: AnimalQueryFilterDto
  ): Promise<PaginatedAnimalsDto>;

  archiveAnimal(
    id: string,
    farmId: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;
}

export const ANIMALS_SERVICE = "ANIMALS_SERVICE";
