import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  FarmRevenueEntity,
  VALID_REVENUE_CATEGORIES,
} from "./farm-revenue.entity";

describe("FarmRevenueEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    recordedById: "22222222-2222-2222-2222-222222222222",
    category: TransactionCategory.MILK_SALES,
    amount: 3450.0,
    currency: "USD",
    referenceNote: "Bulk milk tanker delivery - 5000 liters",
    txDate: new Date("2026-09-10"),
  };

  it("should create a valid FarmRevenueEntity with default syncVersion", () => {
    const entity = FarmRevenueEntity.create(validProps);

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(validProps.farmId);
    expect(entity.recordedById).toBe(validProps.recordedById);
    expect(entity.type).toBe(TransactionType.INCOME);
    expect(entity.category).toBe(TransactionCategory.MILK_SALES);
    expect(entity.amount).toBe(3450.0);
    expect(entity.currency).toBe("USD");
    expect(entity.referenceNote).toBe(validProps.referenceNote);
    expect(entity.syncVersion).toBe(1);
    expect(entity.deletedAt).toBeNull();
    expect(entity.isDeleted).toBe(false);
  });

  it("should allow all valid revenue categories including MANURE and BYPRODUCTS", () => {
    for (const category of VALID_REVENUE_CATEGORIES) {
      const entity = FarmRevenueEntity.create({
        ...validProps,
        category,
      });
      expect(entity.category).toBe(category);
    }
  });

  it("should reject expense categories on revenue entity", () => {
    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        category: TransactionCategory.FEED,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        category: TransactionCategory.MEDICINE,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        category: TransactionCategory.UTILITY,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException for zero or negative amount", () => {
    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        amount: 0,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        amount: -500,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException for invalid currency", () => {
    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        currency: "US",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException for future transaction date", () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(() =>
      FarmRevenueEntity.create({
        ...validProps,
        txDate: futureDate,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should update fields and increment syncVersion", () => {
    const entity = FarmRevenueEntity.create(validProps);

    entity.update({
      amount: 4000.0,
      category: TransactionCategory.MANURE,
      referenceNote: "Organic compost truckload",
      syncVersion: 1,
    });

    expect(entity.amount).toBe(4000.0);
    expect(entity.category).toBe(TransactionCategory.MANURE);
    expect(entity.referenceNote).toBe("Organic compost truckload");
    expect(entity.syncVersion).toBe(2);
  });

  it("should throw optimistic concurrency violation if syncVersion mismatch", () => {
    const entity = FarmRevenueEntity.create(validProps);

    expect(() =>
      entity.update({
        amount: 4000.0,
        syncVersion: 5,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should soft-delete revenue record and block subsequent updates", () => {
    const entity = FarmRevenueEntity.create(validProps);

    entity.softDelete();

    expect(entity.isDeleted).toBe(true);
    expect(entity.deletedAt).toBeInstanceOf(Date);
    expect(entity.syncVersion).toBe(2);

    expect(() => entity.softDelete()).toThrow(ValidationDomainException);
    expect(() => entity.update({ amount: 5000 })).toThrow(
      ValidationDomainException
    );
  });

  it("should convert correctly to DTO with animal and recorder info", () => {
    const entity = new FarmRevenueEntity({
      id: "44444444-4444-4444-4444-444444444444",
      farmId: validProps.farmId,
      recordedById: validProps.recordedById,
      animalId: "55555555-5555-5555-5555-555555555555",
      type: TransactionType.INCOME,
      category: TransactionCategory.LIVESTOCK_SALES,
      amount: 1800.0,
      currency: "USD",
      referenceNote: "Sold breeding bull to GreenValley Farm",
      receiptUrl: "https://s3.example.com/invoice-009.pdf",
      metadata: { buyer: "GreenValley Farm", weightKg: 750 },
      txDate: new Date("2026-09-12"),
      syncVersion: 1,
      createdAt: new Date("2026-09-12T12:00:00Z"),
      updatedAt: new Date("2026-09-12T12:00:00Z"),
      deletedAt: null,
      recordedBy: {
        id: validProps.recordedById,
        name: "Farmer Dave",
        email: "dave@farm.com",
      },
      animal: {
        id: "55555555-5555-5555-5555-555555555555",
        tagNumber: "BULL-09",
        name: "Titan",
        species: AnimalSpecies.COW,
      },
    });

    const dto = entity.toDto();

    expect(dto.id).toBe("44444444-4444-4444-4444-444444444444");
    expect(dto.type).toBe(TransactionType.INCOME);
    expect(dto.category).toBe(TransactionCategory.LIVESTOCK_SALES);
    expect(dto.amount).toBe(1800.0);
    expect(dto.animal?.tagNumber).toBe("BULL-09");
    expect(dto.recordedBy?.name).toBe("Farmer Dave");
  });
});
