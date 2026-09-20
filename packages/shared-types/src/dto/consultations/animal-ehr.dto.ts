import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  ConsultationStatus,
  ConsultationType,
  HealthEventType,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  MilkSession,
  SeverityLevel,
  VaccineRecordType,
} from "../../enums/index.js";

export interface EhrActiveWithdrawalAlertDto {
  prescriptionId: string;
  medicationName: string;
  withdrawalDays: number;
  withdrawalType: "MILK" | "MEAT" | "BOTH";
  signedAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface EhrClinicalHighlightsDto {
  totalHealthIncidents: number;
  activeUnresolvedIncidents: number;
  totalVaccinationsAdministered: number;
  overduePreventativeCount: number;
  activeWithdrawalAlertsCount: number;
  lifetimeMedicalCostCents: number;
  lastWeightKg: number | null;
  lastYieldLiters: number | null;
}

export interface EhrAnimalSummaryDto {
  id: string;
  farmId: string;
  tagNumber: string;
  rfidNumber: string | null;
  name: string | null;
  species: AnimalSpecies;
  breed: string | null;
  gender: AnimalGender;
  dateOfBirth: string | null;
  ageFormatted: string;
  weightKg: number | null;
  status: AnimalStatus;
  sire?: { id: string; tagNumber: string; species: string } | null;
  dam?: { id: string; tagNumber: string; species: string } | null;
  farm: { id: string; name: string; farmType: string; country: string };
}

export interface EhrClinicalIncidentDto {
  id: string;
  eventType: HealthEventType;
  severity: SeverityLevel;
  symptoms: string;
  diagnosis: string | null;
  treatment: string | null;
  cost: number;
  resolvedAt: string | null;
  isResolved: boolean;
  recordedBy: { id: string; name: string };
  attendingVet?: { id: string; name: string } | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    s3Key: string;
    caption: string | null;
  }[];
  createdAt: string;
}

export interface EhrPreventativeRecordDto {
  id: string;
  recordType: VaccineRecordType;
  vaccineName: string;
  batchNumber: string | null;
  doseAmount: number;
  doseUnit: string;
  cost: number;
  administeredAt: string;
  nextDueDate: string | null;
  isOverdue: boolean;
  administeredBy: { id: string; name: string };
}

export interface EhrWeightRecordDto {
  id: string;
  weightKg: number;
  recordedAt: string;
  notes: string | null;
  recordedBy: { id: string; name: string };
  weightChangeKg?: number | null;
}

export interface EhrMilkProductionSummaryDto {
  recentLogs: {
    id: string;
    session: MilkSession;
    yieldLiters: number;
    fatPercent: number | null;
    snfPercent: number | null;
    loggedDate: string;
  }[];
  avgYield7Days: number | null;
  avgYield30Days: number | null;
  anomalies: {
    id: string;
    loggedDate: string;
    currentYieldLiters: number;
    baselineYieldLiters: number;
    dropPercentage: number;
    severity: MilkAnomalySeverity;
    status: MilkAnomalyStatus;
    clinicalNotes: string | null;
  }[];
}

export interface EhrConsultationHistoryDto {
  id: string;
  type: ConsultationType;
  status: ConsultationStatus;
  chiefComplaint: string;
  vet?: { id: string; name: string } | null;
  feeCents: number;
  createdAt: string;
}

export interface EhrPrescriptionHistoryDto {
  id: string;
  consultationId: string;
  diagnosis: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    withdrawalDays?: number;
    notes?: string;
  }[];
  pdfS3Key: string;
  digitalSignatureHash: string;
  signedAt: string;
  vet: { id: string; name: string };
}

export interface AnimalEhrResponseDto {
  animal: EhrAnimalSummaryDto;
  highlights: EhrClinicalHighlightsDto;
  activeWithdrawalAlerts: EhrActiveWithdrawalAlertDto[];
  clinicalIncidents: EhrClinicalIncidentDto[];
  preventativeRecords: EhrPreventativeRecordDto[];
  weightHistory: EhrWeightRecordDto[];
  milkProduction?: EhrMilkProductionSummaryDto | null;
  consultationHistory: EhrConsultationHistoryDto[];
  prescriptionHistory: EhrPrescriptionHistoryDto[];
}
