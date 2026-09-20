import {
  AnimalSpecies,
  FoodSafetyRiskLevel,
  MedicationFormulation,
  MedicationRoute,
  StructuredMedicationItemDto,
} from "@vetralink/shared-types";
import { FoodSafetyEngine } from "./food-safety-engine";

describe("FoodSafetyEngine", () => {
  const baseMedication: StructuredMedicationItemDto = {
    name: "Oxytetracycline 200mg/ml",
    formulation: MedicationFormulation.INJECTABLE,
    route: MedicationRoute.INTRAMUSCULAR,
    dosage: "20 mg/kg",
    frequency: "Once daily",
    durationDays: 5,
    withdrawalDays: 21,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    instructions: "Deep IM injection in neck area.",
  };

  describe("isDairySpecies", () => {
    it("should return true for dairy species", () => {
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.COW)).toBe(true);
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.BUFFALO)).toBe(true);
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.GOAT)).toBe(true);
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.SHEEP)).toBe(true);
    });

    it("should return false for non-dairy species", () => {
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.POULTRY)).toBe(false);
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.CAMEL)).toBe(false);
      expect(FoodSafetyEngine.isDairySpecies(AnimalSpecies.OTHER)).toBe(false);
    });
  });

  describe("computeMedicationWithdrawal", () => {
    it("should calculate treatment end date and both milk/meat withdrawal for dairy cow", () => {
      const treatmentStart = new Date("2026-09-20T00:00:00.000Z");
      const now = new Date("2026-09-22T00:00:00.000Z"); // 2 days into treatment

      const result = FoodSafetyEngine.computeMedicationWithdrawal({
        medication: baseMedication,
        treatmentStartDate: treatmentStart,
        species: AnimalSpecies.COW,
        now,
      });

      // 5 days duration: treatment ends on 2026-09-25T00:00:00.000Z
      expect(result.treatmentEndDate).toBe("2026-09-25T00:00:00.000Z");

      // 7 days milk withdrawal after treatment: ends 2026-10-02T00:00:00.000Z
      expect(result.milkWithdrawalEndsAt).toBe("2026-10-02T00:00:00.000Z");
      expect(result.isMilkActive).toBe(true);
      expect(result.milkDaysRemaining).toBe(10); // 10 days remaining from Sept 22 to Oct 2

      // 21 days meat withdrawal after treatment: ends 2026-10-16T00:00:00.000Z
      expect(result.meatWithdrawalEndsAt).toBe("2026-10-16T00:00:00.000Z");
      expect(result.isMeatActive).toBe(true);
      expect(result.meatDaysRemaining).toBe(24); // 24 days remaining from Sept 22 to Oct 16
    });

    it("should ignore milk withdrawal for non-dairy species (e.g. POULTRY)", () => {
      const treatmentStart = new Date("2026-09-20T00:00:00.000Z");
      const now = new Date("2026-09-22T00:00:00.000Z");

      const result = FoodSafetyEngine.computeMedicationWithdrawal({
        medication: baseMedication,
        treatmentStartDate: treatmentStart,
        species: AnimalSpecies.POULTRY,
        now,
      });

      expect(result.isMilkActive).toBe(false);
      expect(result.milkWithdrawalEndsAt).toBeNull();
      expect(result.milkDaysRemaining).toBe(0);
      expect(result.isMeatActive).toBe(true);
      expect(result.meatWithdrawalEndsAt).toBe("2026-10-16T00:00:00.000Z");
    });

    it("should mark withdrawal as inactive when elapsed beyond withdrawal date", () => {
      const treatmentStart = new Date("2026-08-01T00:00:00.000Z");
      const now = new Date("2026-09-20T00:00:00.000Z"); // Way past withdrawal

      const result = FoodSafetyEngine.computeMedicationWithdrawal({
        medication: baseMedication,
        treatmentStartDate: treatmentStart,
        species: AnimalSpecies.COW,
        now,
      });

      expect(result.isMilkActive).toBe(false);
      expect(result.isMeatActive).toBe(false);
      expect(result.milkDaysRemaining).toBe(0);
      expect(result.meatDaysRemaining).toBe(0);
    });
  });

  describe("evaluateRiskLevel", () => {
    it("should evaluate CRITICAL_BOTH when both milk and meat are withdrawn", () => {
      expect(FoodSafetyEngine.evaluateRiskLevel(true, true)).toBe(
        FoodSafetyRiskLevel.CRITICAL_BOTH,
      );
    });

    it("should evaluate MILK_WITHDRAWAL when only milk is withdrawn", () => {
      expect(FoodSafetyEngine.evaluateRiskLevel(true, false)).toBe(
        FoodSafetyRiskLevel.MILK_WITHDRAWAL,
      );
    });

    it("should evaluate MEAT_WITHDRAWAL when only meat is withdrawn", () => {
      expect(FoodSafetyEngine.evaluateRiskLevel(false, true)).toBe(
        FoodSafetyRiskLevel.MEAT_WITHDRAWAL,
      );
    });

    it("should evaluate SAFE when neither is withdrawn", () => {
      expect(FoodSafetyEngine.evaluateRiskLevel(false, false)).toBe(
        FoodSafetyRiskLevel.SAFE,
      );
    });
  });

  describe("buildWarningMessage", () => {
    it("should return undefined for SAFE risk level", () => {
      const msg = FoodSafetyEngine.buildWarningMessage(
        FoodSafetyRiskLevel.SAFE,
        "TAG-101",
        null,
        null,
        0,
        0,
      );
      expect(msg).toBeUndefined();
    });

    it("should include both milk and meat warnings for CRITICAL_BOTH", () => {
      const msg = FoodSafetyEngine.buildWarningMessage(
        FoodSafetyRiskLevel.CRITICAL_BOTH,
        "TAG-101",
        "2026-10-02T00:00:00.000Z",
        "2026-10-16T00:00:00.000Z",
        10,
        24,
      );
      expect(msg).toBeDefined();
      expect(msg).toContain("MILK RESTRICTION");
      expect(msg).toContain("MEAT RESTRICTION");
      expect(msg).toContain("TAG-101");
    });
  });

  describe("aggregateAnimalWithdrawalStatus", () => {
    it("should aggregate multiple medications and calculate maximum remaining days", () => {
      const med1: StructuredMedicationItemDto = {
        name: "Drug A (Long Meat)",
        formulation: MedicationFormulation.INJECTABLE,
        route: MedicationRoute.INTRAMUSCULAR,
        dosage: "10 ml",
        frequency: "Daily",
        durationDays: 3,
        withdrawalDaysMilk: 2,
        withdrawalDaysMeat: 28,
      };

      const med2: StructuredMedicationItemDto = {
        name: "Drug B (Long Milk)",
        formulation: MedicationFormulation.INTRAMAMMARY,
        route: MedicationRoute.INTRAMAMMARY,
        dosage: "1 syringe",
        frequency: "12h",
        durationDays: 2,
        withdrawalDaysMilk: 14,
        withdrawalDaysMeat: 5,
      };

      const treatmentStart = new Date("2026-09-20T00:00:00.000Z");
      const now = new Date("2026-09-21T00:00:00.000Z");

      const status = FoodSafetyEngine.aggregateAnimalWithdrawalStatus({
        animalId: "animal-1",
        animalTag: "COW-999",
        species: AnimalSpecies.COW,
        farmId: "farm-1",
        prescriptions: [
          {
            id: "rx-1",
            consultationId: "c-1",
            signedAt: treatmentStart,
            createdAt: treatmentStart,
            medications: [med1, med2],
          },
        ],
        now,
      });

      expect(status.riskLevel).toBe(FoodSafetyRiskLevel.CRITICAL_BOTH);
      expect(status.isMilkWithdrawn).toBe(true);
      expect(status.isMeatWithdrawn).toBe(true);
      expect(status.activeMedications).toHaveLength(2);
      // Drug B: 2 + 14 = 16 days from Sept 20 -> Oct 6 (15 days remaining from Sept 21)
      expect(status.milkDaysRemaining).toBe(15);
      // Drug A: 3 + 28 = 31 days from Sept 20 -> Oct 21 (30 days remaining from Sept 21)
      expect(status.meatDaysRemaining).toBe(30);
      expect(status.warningMessage).toContain("COW-999");
    });
  });
});
