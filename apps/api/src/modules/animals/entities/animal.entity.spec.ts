import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { AnimalEntity } from "./animal.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("AnimalEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    tagNumber: "cow-001",
    name: "Daisy",
    species: AnimalSpecies.COW,
    breed: "Holstein Friesian",
    gender: AnimalGender.FEMALE,
    dateOfBirth: new Date("2023-01-15"),
    weightKg: 520.5,
    status: AnimalStatus.ACTIVE,
    sireId: "22222222-2222-2222-2222-222222222222",
    damId: "33333333-3333-3333-3333-333333333333",
    metadata: { earTagColor: "yellow" },
  };

  describe("create() and validation", () => {
    it("should instantiate a valid animal with uppercase-normalized tag number", () => {
      const animal = AnimalEntity.create(validProps);

      expect(animal.id).toBeDefined();
      expect(animal.farmId).toBe(validProps.farmId);
      expect(animal.tagNumber).toBe("COW-001");
      expect(animal.name).toBe("Daisy");
      expect(animal.species).toBe(AnimalSpecies.COW);
      expect(animal.breed).toBe("Holstein Friesian");
      expect(animal.gender).toBe(AnimalGender.FEMALE);
      expect(animal.weightKg).toBe(520.5);
      expect(animal.status).toBe(AnimalStatus.ACTIVE);
      expect(animal.sireId).toBe(validProps.sireId);
      expect(animal.damId).toBe(validProps.damId);
      expect(animal.syncVersion).toBe(1);
      expect(animal.deletedAt).toBeNull();
      expect(animal.isActive()).toBe(true);
    });

    it("should create animals across all supported species", () => {
      const speciesList = [
        AnimalSpecies.COW,
        AnimalSpecies.BUFFALO,
        AnimalSpecies.GOAT,
        AnimalSpecies.SHEEP,
        AnimalSpecies.CAMEL,
        AnimalSpecies.POULTRY,
        AnimalSpecies.OTHER,
      ];

      for (const species of speciesList) {
        const animal = AnimalEntity.create({
          ...validProps,
          tagNumber: `TAG-${species}`,
          species,
        });
        expect(animal.species).toBe(species);
      }
    });

    it("should throw ValidationDomainException if tag number is empty or whitespace", () => {
      expect(() =>
        AnimalEntity.create({
          ...validProps,
          tagNumber: "   ",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if date of birth is in the future", () => {
      const futureDate = new Date(Date.now() + 86400000 * 30);
      expect(() =>
        AnimalEntity.create({
          ...validProps,
          dateOfBirth: futureDate,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if weight is zero or negative", () => {
      expect(() =>
        AnimalEntity.create({
          ...validProps,
          weightKg: 0,
        })
      ).toThrow(ValidationDomainException);

      expect(() =>
        AnimalEntity.create({
          ...validProps,
          weightKg: -10,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if animal is designated as its own sire or dam", () => {
      const selfId = "44444444-4444-4444-4444-444444444444";
      expect(() =>
        AnimalEntity.create({
          ...validProps,
          id: selfId,
          sireId: selfId,
        })
      ).toThrow(ValidationDomainException);

      expect(() =>
        AnimalEntity.create({
          ...validProps,
          id: selfId,
          damId: selfId,
        })
      ).toThrow(ValidationDomainException);
    });

    it("should normalize RFID number to uppercase and coerce empty strings to null", () => {
      const animalWithRfid = AnimalEntity.create({
        ...validProps,
        rfidNumber: "  rfid-982000123  ",
      });
      expect(animalWithRfid.rfidNumber).toBe("RFID-982000123");
      expect(animalWithRfid.toResponse().rfidNumber).toBe("RFID-982000123");

      const animalWithEmptyRfid = AnimalEntity.create({
        ...validProps,
        rfidNumber: "   ",
      });
      expect(animalWithEmptyRfid.rfidNumber).toBeNull();
      expect(animalWithEmptyRfid.toResponse().rfidNumber).toBeNull();
    });

    it("should throw ValidationDomainException if RFID number exceeds 50 characters", () => {
      expect(() =>
        AnimalEntity.create({
          ...validProps,
          rfidNumber: "A".repeat(51),
        })
      ).toThrow(ValidationDomainException);
    });
  });

  describe("canProduceMilk()", () => {
    it("should return true for female dairy mammals (COW, BUFFALO, GOAT, SHEEP, CAMEL)", () => {
      const dairySpecies = [
        AnimalSpecies.COW,
        AnimalSpecies.BUFFALO,
        AnimalSpecies.GOAT,
        AnimalSpecies.SHEEP,
        AnimalSpecies.CAMEL,
      ];

      for (const species of dairySpecies) {
        const animal = AnimalEntity.create({
          ...validProps,
          species,
          gender: AnimalGender.FEMALE,
        });
        expect(animal.canProduceMilk()).toBe(true);
      }
    });

    it("should return false for male animals of any species", () => {
      const animal = AnimalEntity.create({
        ...validProps,
        species: AnimalSpecies.COW,
        gender: AnimalGender.MALE,
      });
      expect(animal.canProduceMilk()).toBe(false);
    });

    it("should return false for female non-dairy species (POULTRY, OTHER)", () => {
      const poultry = AnimalEntity.create({
        ...validProps,
        species: AnimalSpecies.POULTRY,
        gender: AnimalGender.FEMALE,
      });
      expect(poultry.canProduceMilk()).toBe(false);

      const other = AnimalEntity.create({
        ...validProps,
        species: AnimalSpecies.OTHER,
        gender: AnimalGender.FEMALE,
      });
      expect(other.canProduceMilk()).toBe(false);
    });
  });

  describe("calculateAgeMonths()", () => {
    it("should return null if dateOfBirth is null", () => {
      const animal = AnimalEntity.create({
        ...validProps,
        dateOfBirth: null,
      });
      expect(animal.calculateAgeMonths()).toBeNull();
    });

    it("should compute exact age in months relative to reference date", () => {
      const animal = AnimalEntity.create({
        ...validProps,
        dateOfBirth: new Date("2023-01-15"),
      });
      const refDate = new Date("2024-03-15");
      expect(animal.calculateAgeMonths(refDate)).toBe(14);
    });
  });

  describe("updateDetails(), softDelete(), and restore()", () => {
    it("should update properties, increment syncVersion, and reflect changes in toResponse()", () => {
      const animal = AnimalEntity.create(validProps);
      const initialVersion = animal.syncVersion;

      animal.updateDetails({
        name: "Daisy Mae",
        weightKg: 540.25,
        status: AnimalStatus.QUARANTINE,
      });

      expect(animal.name).toBe("Daisy Mae");
      expect(animal.weightKg).toBe(540.25);
      expect(animal.status).toBe(AnimalStatus.QUARANTINE);
      expect(animal.syncVersion).toBe(initialVersion + 1);
      expect(animal.toResponse().name).toBe("Daisy Mae");
    });

    it("should handle soft deletion and restoration correctly", () => {
      const animal = AnimalEntity.create(validProps);
      expect(animal.isActive()).toBe(true);
      expect(animal.isSoftDeleted()).toBe(false);

      const deleteTime = new Date();
      animal.softDelete(deleteTime);

      expect(animal.deletedAt).toEqual(deleteTime);
      expect(animal.isSoftDeleted()).toBe(true);
      expect(animal.isActive()).toBe(false);

      animal.restore();
      expect(animal.deletedAt).toBeNull();
      expect(animal.isActive()).toBe(true);
    });
  });
});
