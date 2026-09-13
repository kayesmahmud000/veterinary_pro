import {
  PreventativeScheduleStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { VaccineRecordEntity } from "./vaccine-record.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("VaccineRecordEntity", () => {
  const defaultProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    animalId: "22222222-2222-2222-2222-222222222222",
    administeredById: "33333333-3333-3333-3333-333333333333",
    recordType: VaccineRecordType.VACCINATION,
    vaccineName: "Foot and Mouth Disease (FMD) Quadrivalent",
    batchNumber: "FMD-2026-B89",
    doseAmount: 2.5,
    doseUnit: "ml",
    cost: 15.0,
    administeredAt: new Date("2026-09-01T08:00:00.000Z"),
    nextDueDate: new Date("2027-03-01T00:00:00.000Z"),
  };

  it("should create a valid VaccineRecordEntity", () => {
    const entity = VaccineRecordEntity.create(defaultProps);

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(defaultProps.farmId);
    expect(entity.recordType).toBe(VaccineRecordType.VACCINATION);
    expect(entity.vaccineName).toBe(defaultProps.vaccineName);
    expect(entity.doseAmount).toBe(2.5);
    expect(entity.cost).toBe(15.0);
    expect(entity.syncVersion).toBe(1);
    expect(entity.isOverdue(new Date("2026-09-13"))).toBe(false);
  });

  it("should throw if doseAmount is zero or negative", () => {
    expect(() =>
      VaccineRecordEntity.create({ ...defaultProps, doseAmount: 0 })
    ).toThrow(ValidationDomainException);

    expect(() =>
      VaccineRecordEntity.create({ ...defaultProps, doseAmount: -2 })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if cost is negative", () => {
    expect(() =>
      VaccineRecordEntity.create({ ...defaultProps, cost: -5 })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if nextDueDate is before administeredAt", () => {
    expect(() =>
      VaccineRecordEntity.create({
        ...defaultProps,
        administeredAt: new Date("2026-09-10"),
        nextDueDate: new Date("2026-09-01"),
      })
    ).toThrow(ValidationDomainException);
  });

  it("should correctly identify OVERDUE schedule status", () => {
    const pastDueEntity = VaccineRecordEntity.create({
      ...defaultProps,
      administeredAt: new Date("2026-01-01"),
      nextDueDate: new Date("2026-07-01"),
    });

    const asOfDate = new Date("2026-09-13");
    expect(pastDueEntity.isOverdue(asOfDate)).toBe(true);
    expect(pastDueEntity.getScheduleStatus(asOfDate)).toBe(
      PreventativeScheduleStatus.OVERDUE
    );
  });

  it("should correctly identify DUE_SOON schedule status (within 14 days)", () => {
    const dueSoonEntity = VaccineRecordEntity.create({
      ...defaultProps,
      administeredAt: new Date("2026-03-01"),
      nextDueDate: new Date("2026-09-20"),
    });

    const asOfDate = new Date("2026-09-13");
    expect(dueSoonEntity.isOverdue(asOfDate)).toBe(false);
    expect(dueSoonEntity.getScheduleStatus(asOfDate)).toBe(
      PreventativeScheduleStatus.DUE_SOON
    );
  });

  it("should correctly identify UPCOMING schedule status (> 14 days)", () => {
    const upcomingEntity = VaccineRecordEntity.create({
      ...defaultProps,
      administeredAt: new Date("2026-09-01"),
      nextDueDate: new Date("2026-12-01"),
    });

    const asOfDate = new Date("2026-09-13");
    expect(upcomingEntity.getScheduleStatus(asOfDate)).toBe(
      PreventativeScheduleStatus.UPCOMING
    );
  });

  it("should return COMPLETED when no nextDueDate is set", () => {
    const completedEntity = VaccineRecordEntity.create({
      ...defaultProps,
      nextDueDate: null,
    });

    expect(completedEntity.getScheduleStatus()).toBe(
      PreventativeScheduleStatus.COMPLETED
    );
    expect(completedEntity.isOverdue()).toBe(false);
  });

  it("should update entity and increment syncVersion", () => {
    const entity = VaccineRecordEntity.create(defaultProps);

    entity.update({
      vaccineName: "Updated FMD Booster",
      doseAmount: 3.0,
      cost: 20.0,
      notes: "Administered via deep intramuscular injection",
    });

    expect(entity.vaccineName).toBe("Updated FMD Booster");
    expect(entity.doseAmount).toBe(3.0);
    expect(entity.cost).toBe(20.0);
    expect(entity.notes).toBe("Administered via deep intramuscular injection");
    expect(entity.syncVersion).toBe(2);
  });
});
