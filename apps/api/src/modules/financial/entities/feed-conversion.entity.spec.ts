import { FeedEfficiencyRating } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { FeedConversionEntity } from "./feed-conversion.entity";

describe("FeedConversionEntity", () => {
  const farmId = "11111111-1111-1111-1111-111111111111";
  const startDate = "2026-09-01";
  const endDate = "2026-09-30";

  describe("Growth FCR Evaluation", () => {
    it("should compute growth FCR and cost per kg gain accurately", () => {
      const entity = new FeedConversionEntity({
        farmId,
        startDate,
        endDate,
        currency: "USD",
        totalFeedConsumedKg: 1000,
        totalFeedExpense: 400, // $0.40 / kg
        totalMilkYieldLiters: 1500,
        animalWeightData: [
          {
            animalId: "animal-1",
            tagNumber: "COW-001",
            name: "Daisy",
            initialWeightKg: 200,
            finalWeightKg: 250, // gain 50 kg
            assignedFeedKg: 250, // 250 kg feed / 50 kg gain = FCR 5.0 (GOOD)
          },
          {
            animalId: "animal-2",
            tagNumber: "COW-002",
            name: "Bella",
            initialWeightKg: 300,
            finalWeightKg: 400, // gain 100 kg
            assignedFeedKg: 300, // 300 kg feed / 100 kg gain = FCR 3.0 (EXCELLENT)
          },
        ],
      });

      expect(entity.totalFeedConsumedKg).toBe(1000);
      expect(entity.totalFeedExpense).toBe(400);
      expect(entity.averageFeedCostPerKg).toBe(0.4);

      const growth = entity.growthFcr;
      expect(growth.totalWeightGainKg).toBe(150);
      // Overall FCR = 1000 / 150 = 6.67
      expect(growth.overallFcr).toBe(6.67);
      // Feed cost per kg gain = 400 / 150 = 2.67
      expect(growth.feedCostPerKgGain).toBe(2.67);
      expect(growth.rating).toBe(FeedEfficiencyRating.AVERAGE);
      expect(growth.animalsEvaluatedCount).toBe(2);

      // Animal 1: Daisy
      expect(growth.animals[0]?.fcr).toBe(5.0);
      expect(growth.animals[0]?.costPerKgGain).toBe(2.0); // (250 * 0.40) / 50 = 100 / 50 = 2.0
      expect(growth.animals[0]?.rating).toBe(FeedEfficiencyRating.GOOD);

      // Animal 2: Bella
      expect(growth.animals[1]?.fcr).toBe(3.0);
      expect(growth.animals[1]?.rating).toBe(FeedEfficiencyRating.EXCELLENT);
    });
  });

  describe("Dairy Feed Efficiency Evaluation", () => {
    it("should compute feed-to-milk ratio and milk yield per kg feed", () => {
      const entity = new FeedConversionEntity({
        farmId,
        startDate,
        endDate,
        totalFeedConsumedKg: 1000,
        totalFeedExpense: 350,
        totalMilkYieldLiters: 1600,
      });

      const dairy = entity.dairyFeedEfficiency;
      expect(dairy.totalMilkYieldLiters).toBe(1600);
      // Feed to milk = 1000 / 1600 = 0.63 kg/L
      expect(dairy.feedToMilkRatioKgPerLiter).toBe(0.63);
      // Milk per kg feed = 1600 / 1000 = 1.6 L/kg
      expect(dairy.milkPerKgFeedLiters).toBe(1.6);
      expect(dairy.rating).toBe(FeedEfficiencyRating.EXCELLENT);
    });
  });

  describe("Zero Division Safeguards", () => {
    it("should handle zero feed intake and zero yield safely", () => {
      const entity = new FeedConversionEntity({
        farmId,
        startDate,
        endDate,
        totalFeedConsumedKg: 0,
        totalFeedExpense: 0,
        totalMilkYieldLiters: 0,
        animalWeightData: [],
      });

      expect(entity.averageFeedCostPerKg).toBe(0);
      expect(entity.growthFcr.overallFcr).toBeNull();
      expect(entity.growthFcr.feedCostPerKgGain).toBeNull();
      expect(entity.dairyFeedEfficiency.feedToMilkRatioKgPerLiter).toBeNull();
      expect(entity.dairyFeedEfficiency.milkPerKgFeedLiters).toBeNull();
    });
  });

  describe("Validation Invariants", () => {
    it("should throw if startDate is after endDate", () => {
      expect(() => {
        new FeedConversionEntity({
          farmId,
          startDate: "2026-10-01",
          endDate: "2026-09-01",
          totalFeedConsumedKg: 100,
          totalFeedExpense: 50,
          totalMilkYieldLiters: 100,
        });
      }).toThrow(ValidationDomainException);
    });
  });
});
