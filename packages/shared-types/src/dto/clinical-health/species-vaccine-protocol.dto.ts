import { AnimalSpecies, VaccineRecordType } from "../../enums/index.js";

export interface ProtocolStepDto {
  readonly name: string;
  readonly recordType: VaccineRecordType;
  readonly targetDisease: string;
  readonly defaultFrequencyDays: number;
  readonly timingDescription: string;
  readonly mandatory: boolean;
  readonly recommendedDose: string;
  readonly route: string;
}

export interface SpeciesVaccineProtocolDto {
  readonly species: AnimalSpecies;
  readonly speciesDisplayName: string;
  readonly description: string;
  readonly steps: ProtocolStepDto[];
}
