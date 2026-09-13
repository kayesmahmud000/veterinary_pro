import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  FarmExpenseEntity,
  VALID_EXPENSE_CATEGORIES,
} from "./farm-expense.entity";

describe("FarmExpenseEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    recordedById: "22222222-2222-2222-2222-222222222222",
    category: TransactionCategory.FEED,
    amount: 1250.5,
    currency: "USD",
    referenceNote: "Purchased 50 bags of dairy concentrate",
    txDate: new Date("2026-09-10"),
  };

  it("should create a valid FarmExpenseEntity with default syncVersion and timestamps", () => {
    const entity = FarmExpenseEntity.create(validProps);

    expect(entity.id).toBeDefined();
    expect(entity.farmId).toBe(validProps.farmId);
    expect(entity.recordedById).toBe(validProps.recordedById);
    expect(entity.type).toBe(TransactionType.EXPENSE);
    expect(entity.category).toBe(TransactionCategory.FEED);
    expect(entity.amount).toBe(1250.5);
    expect(entity.currency).toBe("USD");
    expect(entity.referenceNote).toBe(validProps.referenceNote);
    expect(entity.syncVersion).toBe(1);
    expect(entity.deletedAt).toBeNull();
    expect(entity.isDeleted).toBe(false);
  });

  it("should format string txDate properly", () => {
    const entity = FarmExpenseEntity.create({
      ...validProps,
      txDate: "2026-09-08",
    });

    expect(entity.txDate.toISOString().startsWith("2026-09-08")).toBe(true);
  });

  it("should round amount to 2 decimal places", () => {
    const entity = FarmExpenseEntity.create({
      ...validProps,
      amount: 49.999,
    });

    expect(entity.amount).toBe(50);
  });

  it("should throw ValidationDomainException if farmId is empty", () => {
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        farmId: "",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if recordedById is empty", () => {
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        recordedById: "  ",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should allow all valid expense categories", () => {
    for (const category of VALID_EXPENSE_CATEGORIES) {
      const entity = FarmExpenseEntity.create({
        ...validProps,
        category,
      });
      expect(entity.category).toBe(category);
    }
  });

  it("should throw ValidationDomainException if category is an income category", () => {
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        category: TransactionCategory.MILK_SALES,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        category: TransactionCategory.LIVESTOCK_SALES,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if amount is zero or negative", () => {
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        amount: 0,
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        amount: -100,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if currency code is invalid", () => {
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        currency: "US",
      })
    ).toThrow(ValidationDomainException);

    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        currency: "USDD",
      })
    ).toThrow(ValidationDomainException);
  });

  it("should throw ValidationDomainException if txDate is far in the future", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(() =>
      FarmExpenseEntity.create({
        ...validProps,
        txDate: futureDate,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should successfully update fields and increment syncVersion", () => {
    const entity = FarmExpenseEntity.create(validProps);

    entity.update({
      amount: 1400.0,
      category: TransactionCategory.EQUIPMENT,
      referenceNote: "Updated note",
      syncVersion: 1,
    });

    expect(entity.amount).toBe(1400.0);
    expect(entity.category).toBe(TransactionCategory.EQUIPMENT);
    expect(entity.referenceNote).toBe("Updated note");
    expect(entity.syncVersion).toBe(2);
  });

  it("should throw optimistic concurrency error if syncVersion does not match", () => {
    const entity = FarmExpenseEntity.create(validProps);

    expect(() =>
      entity.update({
        amount: 1500,
        syncVersion: 99,
      })
    ).toThrow(ValidationDomainException);
  });

  it("should soft-delete an active expense and prevent further updates", () => {
    const entity = FarmExpenseEntity.create(validProps);

    entity.softDelete();

    expect(entity.isDeleted).toBe(true);
    expect(entity.deletedAt).toBeInstanceOf(Date);
    expect(entity.syncVersion).toBe(2);

    expect(() => entity.softDelete()).toThrow(ValidationDomainException);
    expect(() => entity.update({ amount: 2000 })).toThrow(
      ValidationDomainException
    );
  });

  it("should convert correctly to DTO including relations", () => {
    const entity = new FarmExpenseEntity({
      id: "33333333-3333-3333-3333-333333333333",
      farmId: validProps.farmId,
      recordedById: validProps.recordedById,
      animalId: "44444444-4444-4444-4444-444444444444",
      type: TransactionType.EXPENSE,
      category: TransactionCategory.MEDICINE,
      amount: 75.25,
      currency: "USD",
      referenceNote: "Mastitis antibiotic tube",
      receiptUrl: "https://s3.example.com/receipt.pdf",
      metadata: { vendor: "AgriVet Supplies" },
      txDate: new Date("2026-09-12"),
      syncVersion: 1,
      createdAt: new Date("2026-09-12T08:00:00Z"),
      updatedAt: new Date("2026-09-12T08:00:00Z"),
      deletedAt: null,
      recordedBy: {
        id: validProps.recordedById,
        name: "Dr. John Vet",
        email: "vet@vetralink.pro",
      },
      animal: {
        id: "44444444-4444-4444-4444-444444444444",
        tagNumber: "COW-0042",
        name: "Daisy",
        species: AnimalSpecies.COW,
      },
    });

    const dto = entity.toDto();

    expect(dto.id).toBe("33333333-3333-3333-3333-333333333333");
    expect(dto.amount).toBe(75.25);
    expect(dto.category).toBe(TransactionCategory.MEDICINE);
    expect(dto.receiptUrl).toBe("https://s3.example.com/receipt.pdf");
    expect(dto.metadata).toEqual({ vendor: "AgriVet Supplies" });
    expect(dto.recordedBy?.name).toBe("Dr. John Vet");
    expect(dto.animal?.tagNumber).toBe("COW-0042");
  });
});
