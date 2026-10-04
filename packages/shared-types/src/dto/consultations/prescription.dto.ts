import {
  MedicationFormulation,
  MedicationRoute,
  PrescriptionStatus,
} from "../../enums";

export interface StructuredMedicationItemDto {
  name: string;
  formulation: MedicationFormulation;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: MedicationRoute;
  withdrawalDays?: number;
  withdrawalDaysMilk?: number;
  withdrawalDaysMeat?: number;
  instructions?: string;
}

export interface PrescriptionDto {
  id: string;
  consultationId: string;
  vetId: string;
  vetName: string;
  status: PrescriptionStatus;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  withdrawalDays: number;
  pdfS3Key?: string | null;
  digitalSignatureHash?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrescriptionDto {
  diagnosis: string;
  notes?: string;
  medications: StructuredMedicationItemDto[];
}

export interface UpdatePrescriptionDto {
  diagnosis?: string;
  notes?: string;
  medications?: StructuredMedicationItemDto[];
}

export interface SignPrescriptionDto {
  licenseNumber?: string;
}

export interface CanonicalPrescriptionPayload {
  prescriptionId: string;
  consultationId: string;
  vetId: string;
  vetName: string;
  vetLicenseNumber: string;
  animalId: string;
  animalTag: string;
  farmId: string;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  withdrawalDays: number;
  signedAt: string;
}

export interface SignatureVerificationResultDto {
  isValid: boolean;
  algorithm: string;
  prescriptionHash: string;
  signedAt: string;
  signerVetName: string;
  signerLicenseNumber: string;
}

export interface PublicPrescriptionVerificationDto {
  isValid: boolean;
  status: PrescriptionStatus;
  algorithm: string;
  prescriptionHash: string;
  signedAt: string | null;
  consultationId: string;
  prescriptionId: string;
  clinicName: string;
  attendingVet: {
    name: string;
    licenseNumber: string;
  };
  farm: {
    name: string;
  };
  animal: {
    species: string;
    tagNumber: string;
    name?: string | null;
  };
  diagnosis: string;
  medications: Array<{
    name: string;
    formulation: string;
    route: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    withdrawalDays: number;
    withdrawalDaysMilk?: number;
    withdrawalDaysMeat?: number;
    instructions?: string;
  }>;
  withdrawalSummary: {
    hasActiveWithdrawal: boolean;
    maxWithdrawalDays: number;
    milkWithdrawalDays: number;
    meatWithdrawalDays: number;
    safeHarvestDate?: string | null;
  };
  verifiedAt: string;
  tamperWarning?: string;
}
