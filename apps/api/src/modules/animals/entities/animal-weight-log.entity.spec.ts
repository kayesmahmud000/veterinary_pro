import { AnimalWeightLogEntity } from "./animal-weight-log.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("AnimalWeightLogEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    animalId: "22222222-2222-2222-2222-222222222222",
    recordedById: "33333333-3333-3333-3333-333333333333",
    weightKg: 520.5,
    recordedAt: new Date("2024-03-01T10:00:00.000Z"),
    notes: "Regular monthly weighing",
    recordedByName: "Dr. Smith",
  };

  it("should create a valid AnimalWeightLogEntity", () => {
    const entity = AnimalWeightLogEntity.create(validProps);

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(validProps.farmId);
    expect(entity.animalId).toBe(validProps.animalId);
    expect(entity.recordedById).toBe(validProps.recordedById);
    expect(entity.weightKg).toBe(520.5);
    expect(entity.recordedAt).toEqual(validProps.recordedAt);
    expect(entity.notes).toBe("Regular monthly weighing");
    expect(entity.recordedByName).toBe("Dr. Smith");
    expect(entity.syncVersion).toBe(1);
    expect(entity.createdAt).toBeDefined();
  });

  it("should throw ValidationDomainException if weightKg <= 0", () => {
    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        weightKg: 0,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        weightKg: -50,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if weightKg > 2500", () => {
    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        weightKg: 2501,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if recordedAt is in the future", () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day in future
    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        recordedAt: futureDate,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if required IDs are missing", () => {
    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        farmId: "   ",
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        animalId: "",
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      AnimalWeightLogEntity.create({
        ...validProps,
        recordedById: "  ",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should compute age in days from animal birth date correctly", () => {
    const birthDate = new Date("2023-03-01T00:00:00.000Z");
    const entity = AnimalWeightLogEntity.create(validProps);

    const ageDays = entity.calculateAgeDays(birthDate);
    expect(ageDays).toBe(366); // 2024 is a leap year

    const response = entity.toResponse(birthDate);
    expect(response.ageDays).toBe(366);
    expect(response.weightKg).toBe(520.5);
  });
});
