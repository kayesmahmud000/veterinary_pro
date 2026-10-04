import { FarmRole } from "@vetralink/shared-types";
import { FarmMemberEntity } from "./farm-member.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("FarmMemberEntity", () => {
  const validProps = {
    farmId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    role: FarmRole.HERDSMAN,
  };

  describe("create()", () => {
    it("should create a valid entity with defaults", () => {
      const member = FarmMemberEntity.create(validProps);

      expect(member.id).toBeDefined();
      expect(member.farmId).toBe(validProps.farmId);
      expect(member.userId).toBe(validProps.userId);
      expect(member.role).toBe(FarmRole.HERDSMAN);
      expect(member.createdAt).toBeInstanceOf(Date);
    });

    it("should allow role override", () => {
      const member = FarmMemberEntity.create({
        ...validProps,
        role: FarmRole.OWNER,
      });

      expect(member.role).toBe(FarmRole.OWNER);
      expect(member.isOwner()).toBe(true);
    });
  });

  describe("validation invariants", () => {
    it("should throw ValidationDomainException if farmId is empty", () => {
      expect(() =>
        FarmMemberEntity.create({
          ...validProps,
          farmId: "",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if userId is empty", () => {
      expect(() =>
        FarmMemberEntity.create({
          ...validProps,
          userId: "   ",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if role is invalid", () => {
      expect(() =>
        FarmMemberEntity.create({
          ...validProps,
          role: "SUPER_ROLE" as any,
        })
      ).toThrow(ValidationDomainException);
    });
  });

  describe("role predicates", () => {
    it("should correctly evaluate OWNER capabilities", () => {
      const owner = FarmMemberEntity.create({
        ...validProps,
        role: FarmRole.OWNER,
      });

      expect(owner.isOwner()).toBe(true);
      expect(owner.isManager()).toBe(false);
      expect(owner.canManageLivestock()).toBe(true);
      expect(owner.canManageHealth()).toBe(true);
      expect(owner.canManageFinances()).toBe(true);
    });

    it("should correctly evaluate MANAGER capabilities", () => {
      const manager = FarmMemberEntity.create({
        ...validProps,
        role: FarmRole.MANAGER,
      });

      expect(manager.isOwner()).toBe(false);
      expect(manager.isManager()).toBe(true);
      expect(manager.canManageLivestock()).toBe(true);
      expect(manager.canManageHealth()).toBe(true);
      expect(manager.canManageFinances()).toBe(true);
    });

    it("should correctly evaluate HERDSMAN capabilities", () => {
      const herdsman = FarmMemberEntity.create({
        ...validProps,
        role: FarmRole.HERDSMAN,
      });

      expect(herdsman.canManageLivestock()).toBe(true);
      expect(herdsman.canManageHealth()).toBe(false);
      expect(herdsman.canManageFinances()).toBe(false);
    });

    it("should correctly evaluate VET_STAFF capabilities", () => {
      const vetStaff = FarmMemberEntity.create({
        ...validProps,
        role: FarmRole.VET_STAFF,
      });

      expect(vetStaff.canManageLivestock()).toBe(false);
      expect(vetStaff.canManageHealth()).toBe(true);
      expect(vetStaff.canManageFinances()).toBe(false);
    });

    it("should allow role mutation via changeRole", () => {
      const member = FarmMemberEntity.create(validProps);
      expect(member.role).toBe(FarmRole.HERDSMAN);

      member.changeRole(FarmRole.MANAGER);
      expect(member.role).toBe(FarmRole.MANAGER);
      expect(member.isManager()).toBe(true);
    });
  });
});
