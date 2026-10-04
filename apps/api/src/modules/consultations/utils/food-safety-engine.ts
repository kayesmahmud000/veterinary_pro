import {
  AnimalSpecies,
  FoodSafetyRiskLevel,
  FoodSafetyWithdrawalStatusDto,
  MedicationWithdrawalDetailDto,
  StructuredMedicationItemDto,
} from "@vetralink/shared-types";

export const DAIRY_SPECIES: ReadonlySet<AnimalSpecies> = new Set([
  AnimalSpecies.COW,
  AnimalSpecies.BUFFALO,
  AnimalSpecies.GOAT,
  AnimalSpecies.SHEEP,
]);

export interface ComputeMedicationWithdrawalInput {
  medication: StructuredMedicationItemDto;
  treatmentStartDate: Date;
  species: AnimalSpecies;
  now?: Date;
}

export interface AggregateAnimalWithdrawalInput {
  animalId: string;
  animalTag: string;
  animalName?: string;
  species: AnimalSpecies;
  farmId: string;
  consultationId?: string;
  prescriptionId?: string;
  prescriptions: Array<{
    id: string;
    consultationId: string;
    signedAt: Date | null;
    createdAt: Date;
    medications: StructuredMedicationItemDto[];
  }>;
  now?: Date;
}

export class FoodSafetyEngine {
  public static isDairySpecies(species: AnimalSpecies): boolean {
    return DAIRY_SPECIES.has(species);
  }

  public static computeMedicationWithdrawal(
    input: ComputeMedicationWithdrawalInput,
  ): MedicationWithdrawalDetailDto {
    const { medication, treatmentStartDate, species } = input;
    const now = input.now ?? new Date();
    const isDairy = FoodSafetyEngine.isDairySpecies(species);

    const durationDays = Math.max(1, Number(medication.durationDays || 1));
    const treatmentStartMs = treatmentStartDate.getTime();
    const treatmentEndMs = treatmentStartMs + durationDays * 86400000;
    const treatmentEndDate = new Date(treatmentEndMs);

    // Milk withdrawal
    const withdrawalDaysMilk = Number(medication.withdrawalDaysMilk || 0);
    let milkWithdrawalEndsAt: Date | null = null;
    let isMilkActive = false;
    let milkDaysRemaining = 0;

    if (isDairy && withdrawalDaysMilk > 0) {
      const milkEndsMs = treatmentEndMs + withdrawalDaysMilk * 86400000;
      milkWithdrawalEndsAt = new Date(milkEndsMs);
      if (milkEndsMs > now.getTime()) {
        isMilkActive = true;
        milkDaysRemaining = Math.ceil((milkEndsMs - now.getTime()) / 86400000);
      }
    }

    // Meat withdrawal
    const withdrawalDaysMeat = Number(medication.withdrawalDaysMeat || 0);
    let meatWithdrawalEndsAt: Date | null = null;
    let isMeatActive = false;
    let meatDaysRemaining = 0;

    if (withdrawalDaysMeat > 0) {
      const meatEndsMs = treatmentEndMs + withdrawalDaysMeat * 86400000;
      meatWithdrawalEndsAt = new Date(meatEndsMs);
      if (meatEndsMs > now.getTime()) {
        isMeatActive = true;
        meatDaysRemaining = Math.ceil((meatEndsMs - now.getTime()) / 86400000);
      }
    }

    return {
      medicationName: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      durationDays,
      route: medication.route,
      treatmentStartDate: treatmentStartDate.toISOString(),
      treatmentEndDate: treatmentEndDate.toISOString(),
      withdrawalDaysMilk,
      withdrawalDaysMeat,
      milkWithdrawalEndsAt: milkWithdrawalEndsAt
        ? milkWithdrawalEndsAt.toISOString()
        : null,
      meatWithdrawalEndsAt: meatWithdrawalEndsAt
        ? meatWithdrawalEndsAt.toISOString()
        : null,
      isMilkActive,
      isMeatActive,
      milkDaysRemaining,
      meatDaysRemaining,
      instructions: medication.instructions,
    };
  }

  public static evaluateRiskLevel(
    isMilkWithdrawn: boolean,
    isMeatWithdrawn: boolean,
  ): FoodSafetyRiskLevel {
    if (isMilkWithdrawn && isMeatWithdrawn) {
      return FoodSafetyRiskLevel.CRITICAL_BOTH;
    }
    if (isMilkWithdrawn) {
      return FoodSafetyRiskLevel.MILK_WITHDRAWAL;
    }
    if (isMeatWithdrawn) {
      return FoodSafetyRiskLevel.MEAT_WITHDRAWAL;
    }
    return FoodSafetyRiskLevel.SAFE;
  }

  public static buildWarningMessage(
    riskLevel: FoodSafetyRiskLevel,
    animalTag: string,
    milkEndsAt: string | null,
    meatEndsAt: string | null,
    milkDays: number,
    meatDays: number,
  ): string | undefined {
    if (riskLevel === FoodSafetyRiskLevel.SAFE) {
      return undefined;
    }

    const warnings: string[] = [];

    if (
      riskLevel === FoodSafetyRiskLevel.MILK_WITHDRAWAL ||
      riskLevel === FoodSafetyRiskLevel.CRITICAL_BOTH
    ) {
      warnings.push(
        `MILK RESTRICTION: Milk from animal '${animalTag}' must NOT be consumed or added to bulk storage until ${milkEndsAt} (${milkDays} day${milkDays === 1 ? "" : "s"} remaining). Discard all milk during this withdrawal window.`,
      );
    }

    if (
      riskLevel === FoodSafetyRiskLevel.MEAT_WITHDRAWAL ||
      riskLevel === FoodSafetyRiskLevel.CRITICAL_BOTH
    ) {
      warnings.push(
        `MEAT RESTRICTION: Animal '${animalTag}' is prohibited from slaughter or meat production until ${meatEndsAt} (${meatDays} day${meatDays === 1 ? "" : "s"} remaining).`,
      );
    }

    return warnings.join(" | ");
  }

  public static aggregateAnimalWithdrawalStatus(
    input: AggregateAnimalWithdrawalInput,
  ): FoodSafetyWithdrawalStatusDto {
    const now = input.now ?? new Date();
    const allMedicationDetails: MedicationWithdrawalDetailDto[] = [];

    for (const rx of input.prescriptions) {
      const startDate = rx.signedAt ? new Date(rx.signedAt) : new Date(rx.createdAt);
      for (const med of rx.medications) {
        const detail = FoodSafetyEngine.computeMedicationWithdrawal({
          medication: med,
          treatmentStartDate: startDate,
          species: input.species,
          now,
        });
        allMedicationDetails.push(detail);
      }
    }

    // Filter active medications
    const activeMedications = allMedicationDetails.filter(
      (m) => m.isMilkActive || m.isMeatActive,
    );

    const isMilkWithdrawn = activeMedications.some((m) => m.isMilkActive);
    const isMeatWithdrawn = activeMedications.some((m) => m.isMeatActive);

    // Compute outer bounds
    let latestMilkEndsAt: Date | null = null;
    let maxMilkDaysRemaining = 0;
    let latestMeatEndsAt: Date | null = null;
    let maxMeatDaysRemaining = 0;

    for (const med of activeMedications) {
      if (med.isMilkActive && med.milkWithdrawalEndsAt) {
        const d = new Date(med.milkWithdrawalEndsAt);
        if (!latestMilkEndsAt || d.getTime() > latestMilkEndsAt.getTime()) {
          latestMilkEndsAt = d;
        }
        if (med.milkDaysRemaining > maxMilkDaysRemaining) {
          maxMilkDaysRemaining = med.milkDaysRemaining;
        }
      }

      if (med.isMeatActive && med.meatWithdrawalEndsAt) {
        const d = new Date(med.meatWithdrawalEndsAt);
        if (!latestMeatEndsAt || d.getTime() > latestMeatEndsAt.getTime()) {
          latestMeatEndsAt = d;
        }
        if (med.meatDaysRemaining > maxMeatDaysRemaining) {
          maxMeatDaysRemaining = med.meatDaysRemaining;
        }
      }
    }

    const riskLevel = FoodSafetyEngine.evaluateRiskLevel(
      isMilkWithdrawn,
      isMeatWithdrawn,
    );

    const milkWithdrawalEndsAt = latestMilkEndsAt
      ? latestMilkEndsAt.toISOString()
      : null;
    const meatWithdrawalEndsAt = latestMeatEndsAt
      ? latestMeatEndsAt.toISOString()
      : null;

    const warningMessage = FoodSafetyEngine.buildWarningMessage(
      riskLevel,
      input.animalTag,
      milkWithdrawalEndsAt,
      meatWithdrawalEndsAt,
      maxMilkDaysRemaining,
      maxMeatDaysRemaining,
    );

    return {
      animalId: input.animalId,
      animalTag: input.animalTag,
      animalName: input.animalName,
      species: input.species,
      farmId: input.farmId,
      consultationId: input.consultationId,
      prescriptionId: input.prescriptionId,
      riskLevel,
      isMilkWithdrawn,
      isMeatWithdrawn,
      milkWithdrawalEndsAt,
      meatWithdrawalEndsAt,
      milkDaysRemaining: maxMilkDaysRemaining,
      meatDaysRemaining: maxMeatDaysRemaining,
      activeMedications,
      warningMessage,
    };
  }
}
