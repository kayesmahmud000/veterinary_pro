import {
  AnimalSpecies,
  FoodSafetyRiskLevel,
  MedicationRoute,
} from "../../enums/index.js";

export interface MedicationWithdrawalDetailDto {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: MedicationRoute;
  treatmentStartDate: string;
  treatmentEndDate: string;
  withdrawalDaysMilk: number;
  withdrawalDaysMeat: number;
  milkWithdrawalEndsAt: string | null;
  meatWithdrawalEndsAt: string | null;
  isMilkActive: boolean;
  isMeatActive: boolean;
  milkDaysRemaining: number;
  meatDaysRemaining: number;
  instructions?: string;
}

export interface FoodSafetyWithdrawalStatusDto {
  animalId: string;
  animalTag: string;
  animalName?: string;
  species: AnimalSpecies;
  farmId: string;
  consultationId?: string;
  prescriptionId?: string;
  riskLevel: FoodSafetyRiskLevel;
  isMilkWithdrawn: boolean;
  isMeatWithdrawn: boolean;
  milkWithdrawalEndsAt: string | null;
  meatWithdrawalEndsAt: string | null;
  milkDaysRemaining: number;
  meatDaysRemaining: number;
  activeMedications: MedicationWithdrawalDetailDto[];
  warningMessage?: string;
}

export interface FarmWithdrawalAlertsDto {
  farmId: string;
  totalAnimalsUnderWithdrawal: number;
  animalsWithMilkWithdrawal: number;
  animalsWithMeatWithdrawal: number;
  alerts: FoodSafetyWithdrawalStatusDto[];
}

export interface WithdrawalAlertDispatchResultDto {
  consultationId: string;
  animalId: string;
  farmerId: string;
  riskLevel: FoodSafetyRiskLevel;
  notificationsSent: {
    push: boolean;
    sms: boolean;
    email: boolean;
  };
  dispatchedAt: string;
}
