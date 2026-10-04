import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { VetProfileEntity } from "./vet-profile.entity";

describe("VetProfileEntity", () => {
  const mockProps = {
    userId: "user-vet-1",
    specialties: ["COW", "BUFFALO"],
    isAvailable: true,
    maxActiveCases: 5,
    workingHours: [
      { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }, // Monday
      { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" }, // Tuesday
    ],
    timezone: "UTC",
  };

  describe("create()", () => {
    it("should instantiate with defaults and valid props", () => {
      const entity = VetProfileEntity.create(mockProps);

      expect(entity.id).toBeDefined();
      expect(entity.userId).toBe("user-vet-1");
      expect(entity.specialties).toEqual(["COW", "BUFFALO"]);
      expect(entity.isAvailable).toBe(true);
      expect(entity.maxActiveCases).toBe(5);
      expect(entity.workingHours).toHaveLength(2);
    });

    it("should throw if userId is empty", () => {
      expect(() =>
        VetProfileEntity.create({ ...mockProps, userId: "" }),
      ).toThrow(ValidationDomainException);
    });
  });

  describe("matchesSpecialty()", () => {
    it("should return exact match when species is in specialties", () => {
      const entity = VetProfileEntity.create(mockProps);
      const result = entity.matchesSpecialty("COW");

      expect(result.matches).toBe(true);
      expect(result.isExact).toBe(true);
    });

    it("should return non-exact match if vet has GENERAL or empty specialties", () => {
      const generalEntity = VetProfileEntity.create({
        ...mockProps,
        specialties: ["GENERAL"],
      });
      const result = generalEntity.matchesSpecialty("SHEEP");

      expect(result.matches).toBe(true);
      expect(result.isExact).toBe(false);
    });

    it("should return false if species is not covered", () => {
      const entity = VetProfileEntity.create(mockProps);
      const result = entity.matchesSpecialty("POULTRY");

      expect(result.matches).toBe(false);
      expect(result.isExact).toBe(false);
    });
  });

  describe("isAvailableAt()", () => {
    it("should return false if isAvailable is false", () => {
      const entity = VetProfileEntity.create({
        ...mockProps,
        isAvailable: false,
      });

      expect(entity.isAvailableAt()).toBe(false);
    });

    it("should return true if available and within working hours", () => {
      const entity = VetProfileEntity.create(mockProps);
      // Monday 2026-09-21 at 10:00 UTC
      const monday10am = new Date("2026-09-21T10:00:00.000Z");

      expect(entity.isAvailableAt(monday10am)).toBe(true);
    });

    it("should return false if outside working hours on working day", () => {
      const entity = VetProfileEntity.create(mockProps);
      // Monday at 19:00 UTC
      const monday7pm = new Date("2026-09-21T19:00:00.000Z");

      expect(entity.isAvailableAt(monday7pm)).toBe(false);
    });

    it("should return false if on non-working day", () => {
      const entity = VetProfileEntity.create(mockProps);
      // Sunday 2026-09-27
      const sunday = new Date("2026-09-27T10:00:00.000Z");

      expect(entity.isAvailableAt(sunday)).toBe(false);
    });
  });

  describe("canAcceptMoreCases()", () => {
    it("should return true when active cases is less than maxActiveCases", () => {
      const entity = VetProfileEntity.create(mockProps);
      expect(entity.canAcceptMoreCases(4)).toBe(true);
    });

    it("should return false when active cases reaches or exceeds maxActiveCases", () => {
      const entity = VetProfileEntity.create(mockProps);
      expect(entity.canAcceptMoreCases(5)).toBe(false);
      expect(entity.canAcceptMoreCases(6)).toBe(false);
    });
  });

  describe("update()", () => {
    it("should update properties correctly", () => {
      const entity = VetProfileEntity.create(mockProps);
      entity.update({
        isAvailable: false,
        maxActiveCases: 10,
        specialties: ["POULTRY"],
      });

      expect(entity.isAvailable).toBe(false);
      expect(entity.maxActiveCases).toBe(10);
      expect(entity.specialties).toEqual(["POULTRY"]);
    });

    it("should throw if maxActiveCases is invalid", () => {
      const entity = VetProfileEntity.create(mockProps);
      expect(() => entity.update({ maxActiveCases: 0 })).toThrow(
        ValidationDomainException,
      );
      expect(() => entity.update({ maxActiveCases: 51 })).toThrow(
        ValidationDomainException,
      );
    });
  });
});
