import { AnimalEhrResponseDto, JwtPayload } from "@vetralink/shared-types";

export const ANIMAL_EHR_SERVICE = Symbol("ANIMAL_EHR_SERVICE");

export interface IAnimalEhrService {
  getConsultationEhr(
    consultationId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<AnimalEhrResponseDto>;

  getAnimalEhr(
    animalId: string,
    requestingUser: JwtPayload,
    traceId?: string,
  ): Promise<AnimalEhrResponseDto>;
}
