import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  HealthEventType,
  MilkSession,
  SeverityLevel,
  TransactionCategory,
  TransactionType,
  VaccineRecordType,
} from "../../enums/index.js";

export interface SyncAnimalDto {
  id: string;
  farmId: string;
  tagNumber: string;
  rfidNumber?: string | null;
  name?: string | null;
  species: AnimalSpecies;
  breed?: string | null;
  gender: AnimalGender;
  dateOfBirth?: string | null;
  weightKg?: number | null;
  status: AnimalStatus;
  sireId?: string | null;
  damId?: string | null;
  metadata?: Record<string, unknown>;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SyncMilkLogDto {
  id: string;
  farmId: string;
  animalId?: string | null;
  recordedById: string;
  session: MilkSession;
  yieldLiters: number;
  fatPercent?: number | null;
  snfPercent?: number | null;
  loggedDate: string;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncHealthRecordDto {
  id: string;
  farmId: string;
  animalId: string;
  recordedById: string;
  attendingVetId?: string | null;
  eventType: HealthEventType;
  severity: SeverityLevel;
  symptoms: string;
  diagnosis?: string | null;
  treatment?: string | null;
  cost: number;
  resolvedAt?: string | null;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncVaccineRecordDto {
  id: string;
  farmId: string;
  animalId: string;
  administeredBy: string;
  recordType: VaccineRecordType;
  vaccineName: string;
  batchNumber?: string | null;
  doseAmount: number;
  doseUnit: string;
  cost: number;
  notes?: string | null;
  administeredAt: string;
  nextDueDate?: string | null;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncWeightLogDto {
  id: string;
  farmId: string;
  animalId: string;
  recordedById: string;
  weightKg: number;
  recordedAt: string;
  notes?: string | null;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncTransactionDto {
  id: string;
  farmId: string;
  recordedById: string;
  animalId?: string | null;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  referenceNote?: string | null;
  receiptUrl?: string | null;
  txDate: string;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
