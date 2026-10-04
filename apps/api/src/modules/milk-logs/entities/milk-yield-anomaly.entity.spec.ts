import {
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";
import { MilkYieldAnomalyEntity } from "./milk-yield-anomaly.entity";

describe("MilkYieldAnomalyEntity", () => {
  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const vetUserId = "33333333-3333-3333-3333-333333333333";
  const loggedDate = new Date("2026-09-13T00:00:00.000Z");

  it("should create a new MilkYieldAnomalyEntity with DETECTED status", () => {
    const entity = MilkYieldAnomalyEntity.create({
      farmId,
      animalId,
      loggedDate,
      currentYieldLiters: 12.0,
      baselineYieldLiters: 20.0,
      dropPercentage: 40.0,
      severity: MilkAnomalySeverity.MEDIUM,
      metadata: { baselineActiveDays: 6 },
    });

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(farmId);
    expect(entity.animalId).toBe(animalId);
    expect(entity.loggedDate).toEqual(loggedDate);
    expect(entity.currentYieldLiters).toBe(12.0);
    expect(entity.baselineYieldLiters).toBe(20.0);
    expect(entity.dropPercentage).toBe(40.0);
    expect(entity.severity).toBe(MilkAnomalySeverity.MEDIUM);
    expect(entity.status).toBe(MilkAnomalyStatus.DETECTED);
    expect(entity.acknowledgedById).toBeNull();
    expect(entity.acknowledgedAt).toBeNull();
    expect(entity.resolvedAt).toBeNull();
  });

  it("should update metrics and recalculate severity", () => {
    const entity = MilkYieldAnomalyEntity.create({
      farmId,
      animalId,
      loggedDate,
      currentYieldLiters: 15.0,
      baselineYieldLiters: 20.0,
      dropPercentage: 25.0,
      severity: MilkAnomalySeverity.LOW,
    });

    entity.updateMetrics(8.0, 20.0, 60.0, MilkAnomalySeverity.CRITICAL, {
      afternoonSessionLogged: true,
    });

    expect(entity.currentYieldLiters).toBe(8.0);
    expect(entity.dropPercentage).toBe(60.0);
    expect(entity.severity).toBe(MilkAnomalySeverity.CRITICAL);
    expect(entity.metadata["afternoonSessionLogged"]).toBe(true);
  });

  it("should transition status on acknowledge", () => {
    const entity = MilkYieldAnomalyEntity.create({
      farmId,
      animalId,
      loggedDate,
      currentYieldLiters: 10.0,
      baselineYieldLiters: 20.0,
      dropPercentage: 50.0,
      severity: MilkAnomalySeverity.CRITICAL,
    });

    entity.acknowledge(vetUserId, "Suspected acute mastitis in rear right quarter.");

    expect(entity.status).toBe(MilkAnomalyStatus.ACKNOWLEDGED);
    expect(entity.acknowledgedById).toBe(vetUserId);
    expect(entity.acknowledgedAt).toBeInstanceOf(Date);
    expect(entity.clinicalNotes).toBe(
      "Suspected acute mastitis in rear right quarter."
    );
  });

  it("should transition status on resolve", () => {
    const entity = MilkYieldAnomalyEntity.create({
      farmId,
      animalId,
      loggedDate,
      currentYieldLiters: 10.0,
      baselineYieldLiters: 20.0,
      dropPercentage: 50.0,
      severity: MilkAnomalySeverity.CRITICAL,
    });

    entity.resolve(
      vetUserId,
      "Treated with intramammary antibiotic; yield restored.",
      MilkAnomalyStatus.RESOLVED
    );

    expect(entity.status).toBe(MilkAnomalyStatus.RESOLVED);
    expect(entity.resolvedAt).toBeInstanceOf(Date);
    expect(entity.resolutionNotes).toBe(
      "Treated with intramammary antibiotic; yield restored."
    );
  });

  it("should serialize to clean response DTO", () => {
    const entity = MilkYieldAnomalyEntity.create({
      farmId,
      animalId,
      loggedDate,
      currentYieldLiters: 12.5,
      baselineYieldLiters: 25.0,
      dropPercentage: 50.0,
      severity: MilkAnomalySeverity.CRITICAL,
    });

    const dto = entity.toResponseDto();
    expect(dto.id).toBe(entity.id);
    expect(dto.loggedDate).toBe("2026-09-13");
    expect(dto.currentYieldLiters).toBe(12.5);
    expect(dto.baselineYieldLiters).toBe(25.0);
    expect(dto.dropPercentage).toBe(50.0);
    expect(dto.status).toBe(MilkAnomalyStatus.DETECTED);
  });
});
