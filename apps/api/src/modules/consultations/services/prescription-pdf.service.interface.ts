import { StructuredMedicationItemDto } from "@vetralink/shared-types";

export interface PrescriptionPdfData {
  prescriptionId: string;
  consultationId: string;
  clinicName?: string;
  vetName: string;
  vetLicenseNumber: string;
  farmName: string;
  farmerName: string;
  animalTag: string;
  animalName?: string;
  animalSpecies: string;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  withdrawalDays: number;
  withdrawalDaysMilk?: number;
  withdrawalDaysMeat?: number;
  digitalSignatureHash: string;
  signedAt: string;
  verifyUrl: string;
}

export const PRESCRIPTION_PDF_SERVICE = Symbol("PRESCRIPTION_PDF_SERVICE");

export interface IPrescriptionPdfService {
  generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer>;
}
