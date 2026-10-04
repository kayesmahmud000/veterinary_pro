import { HealthEventType, SeverityLevel } from "@vetralink/shared-types";
import { HealthRecordEntity } from "./health-record.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("HealthRecordEntity", () => {
  const defaultProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    animalId: "22222222-2222-2222-2222-222222222222",
    recordedById: "33333333-3333-3333-3333-333333333333",
    eventType: HealthEventType.ILLNESS,
    severity: SeverityLevel.MEDIUM,
    symptoms: "High fever and lethargy observed during morning round",
    cost: 45.5,
  };

  it("should create a valid HealthRecordEntity", () => {
    const entity = HealthRecordEntity.create(defaultProps);

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(defaultProps.farmId);
    expect(entity.animalId).toBe(defaultProps.animalId);
    expect(entity.recordedById).toBe(defaultProps.recordedById);
    expect(entity.eventType).toBe(HealthEventType.ILLNESS);
    expect(entity.severity).toBe(SeverityLevel.MEDIUM);
    expect(entity.symptoms).toBe(defaultProps.symptoms);
    expect(entity.cost).toBe(45.5);
    expect(entity.resolvedAt).toBeNull();
    expect(entity.isResolved).toBe(false);
    expect(entity.syncVersion).toBe(1);
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
  });

  it("should throw if farmId is missing or empty", () => {
    expect(() =>
      HealthRecordEntity.create({ ...defaultProps, farmId: "" })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if animalId is missing or empty", () => {
    expect(() =>
      HealthRecordEntity.create({ ...defaultProps, animalId: "   " })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if recordedById is missing or empty", () => {
    expect(() =>
      HealthRecordEntity.create({ ...defaultProps, recordedById: "" })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if symptoms length is less than 3 characters", () => {
    expect(() =>
      HealthRecordEntity.create({ ...defaultProps, symptoms: "ab" })
    ).toThrow(ValidationDomainException);
  });

  it("should throw if cost is negative", () => {
    expect(() =>
      HealthRecordEntity.create({ ...defaultProps, cost: -10 })
    ).toThrow(ValidationDomainException);
  });

  it("should update properties and increment syncVersion", () => {
    const entity = HealthRecordEntity.create(defaultProps);
    const initialSyncVersion = entity.syncVersion;

    entity.update({
      diagnosis: "Bovine Respiratory Disease (BRD)",
      treatment: "Administered Florfenicol 20ml IM",
      cost: 75.0,
      severity: SeverityLevel.HIGH,
    });

    expect(entity.diagnosis).toBe("Bovine Respiratory Disease (BRD)");
    expect(entity.treatment).toBe("Administered Florfenicol 20ml IM");
    expect(entity.cost).toBe(75.0);
    expect(entity.severity).toBe(SeverityLevel.HIGH);
    expect(entity.syncVersion).toBe(initialSyncVersion + 1);
  });

  it("should resolve incident and set resolvedAt", () => {
    const entity = HealthRecordEntity.create(defaultProps);
    expect(entity.isResolved).toBe(false);

    const now = new Date();
    entity.resolve({
      resolvedAt: now,
      treatment: "Full recovery noted",
      cost: 90.0,
    });

    expect(entity.isResolved).toBe(true);
    expect(entity.resolvedAt).toEqual(now);
    expect(entity.treatment).toBe("Full recovery noted");
    expect(entity.cost).toBe(90.0);
  });

  it("should throw if resolve date is before creation date", () => {
    const entity = HealthRecordEntity.create(defaultProps);
    const pastDate = new Date(entity.createdAt.getTime() - 100000);

    expect(() =>
      entity.resolve({ resolvedAt: pastDate })
    ).toThrow(ValidationDomainException);
  });

  it("should correctly serialize to response DTO", () => {
    const entity = HealthRecordEntity.create(defaultProps);
    entity.setAnimalSummary({
      id: defaultProps.animalId,
      tagNumber: "COW-001",
      name: "Daisy",
      species: "COW",
      breed: "Holstein",
      gender: "FEMALE",
    });
    entity.setRecordedBySummary({
      id: defaultProps.recordedById,
      name: "Dr. Vet",
      email: "vet@vetralink.pro",
      role: "VET",
    });

    const dto = entity.toResponseDto();

    expect(dto.id).toBe(entity.id);
    expect(dto.farmId).toBe(defaultProps.farmId);
    expect(dto.animalId).toBe(defaultProps.animalId);
    expect(dto.animal?.tagNumber).toBe("COW-001");
    expect(dto.recordedBy?.name).toBe("Dr. Vet");
    expect(dto.isResolved).toBe(false);
    expect(dto.cost).toBe(45.5);
  });

  it("should support escalation tracking and prevent downgrading level", () => {
    const entity = HealthRecordEntity.create(defaultProps);
    expect(entity.escalationLevel).toBe(0);
    expect(entity.lastEscalatedAt).toBeNull();

    const escalateTime = new Date();
    entity.escalateTo(1, escalateTime);
    expect(entity.escalationLevel).toBe(1);
    expect(entity.lastEscalatedAt).toEqual(escalateTime);

    // Can escalate to higher level
    entity.escalateTo(2);
    expect(entity.escalationLevel).toBe(2);

    // Cannot downgrade
    expect(() => entity.escalateTo(1)).toThrow(ValidationDomainException);
  });
});
