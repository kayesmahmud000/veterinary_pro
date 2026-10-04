import { UserRole, UserStatus } from "@vetralink/shared-types";
import { UserEntity } from "./user.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("UserEntity Domain Model", () => {
  const validProps = {
    email: "Farmer.John@example.com",
    name: "John Doe",
    passwordHash: "$2b$12$e8Yk1.eR/s/fakehashstringexample",
    phone: "+8801712345678",
    phoneHash: "a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123",
  };

  describe("Factory Methods", () => {
    it("should successfully create a new UserEntity with defaults", () => {
      const user = UserEntity.create(validProps);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe("farmer.john@example.com"); // Normalized lowercase
      expect(user.name).toBe("John Doe");
      expect(user.role).toBe(UserRole.FARMER);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.isEmailVerified).toBe(false);
      expect(user.lastLoginAt).toBeNull();
      expect(user.deletedAt).toBeNull();
      expect(user.isActive()).toBe(true);
      expect(user.isDeleted()).toBe(false);
    });

    it("should reconstitute an existing UserEntity from persistence data", () => {
      const existingId = "550e8400-e29b-41d4-a716-446655440000";
      const pastDate = new Date("2026-01-01T00:00:00Z");

      const user = UserEntity.reconstitute({
        id: existingId,
        email: "vet.sarah@vetralink.com",
        name: "Dr. Sarah",
        phone: "+8801812345678",
        phoneHash: "hash123",
        passwordHash: "$2b$12$hashedpassword",
        role: UserRole.VET,
        status: UserStatus.ACTIVE,
        avatarUrl: "https://s3.vetralink.com/sarah.jpg",
        isEmailVerified: true,
        lastLoginAt: pastDate,
        createdAt: pastDate,
        updatedAt: pastDate,
        deletedAt: null,
      });

      expect(user.id).toBe(existingId);
      expect(user.role).toBe(UserRole.VET);
      expect(user.isEmailVerified).toBe(true);
      expect(user.hasRole(UserRole.VET)).toBe(true);
      expect(user.hasRole(UserRole.FARMER)).toBe(false);
    });
  });

  describe("Invariants & Validation", () => {
    it("should throw ValidationDomainException on invalid email", () => {
      expect(() =>
        UserEntity.create({
          ...validProps,
          email: "invalid-email-without-at",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException on empty name", () => {
      expect(() =>
        UserEntity.create({
          ...validProps,
          name: "   ",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException on empty password hash", () => {
      expect(() =>
        UserEntity.create({
          ...validProps,
          passwordHash: "",
        })
      ).toThrow(ValidationDomainException);
    });
  });

  describe("State Mutations & Business Methods", () => {
    let user: UserEntity;

    beforeEach(() => {
      user = UserEntity.create(validProps);
    });

    it("should update profile name and avatar", () => {
      user.updateProfile("Johnathan Doe", "https://img.com/avatar.png");
      expect(user.name).toBe("Johnathan Doe");
      expect(user.avatarUrl).toBe("https://img.com/avatar.png");
    });

    it("should throw if updated profile name is blank", () => {
      expect(() => user.updateProfile("  ")).toThrow(ValidationDomainException);
    });

    it("should change phone number and phone hash", () => {
      user.changePhone("+8801999999999", "newHash999");
      expect(user.phone).toBe("+8801999999999");
      expect(user.phoneHash).toBe("newHash999");
    });

    it("should remove phone number", () => {
      user.removePhone();
      expect(user.phone).toBeNull();
      expect(user.phoneHash).toBeNull();
    });

    it("should verify email", () => {
      expect(user.isEmailVerified).toBe(false);
      user.verifyEmail();
      expect(user.isEmailVerified).toBe(true);
    });

    it("should update password", () => {
      user.updatePassword("$2b$12$newHashExampleString");
      expect(user.passwordHash).toBe("$2b$12$newHashExampleString");
    });

    it("should record login timestamp", () => {
      expect(user.lastLoginAt).toBeNull();
      const loginTime = new Date("2026-09-05T12:00:00Z");
      user.recordLogin(loginTime);
      expect(user.lastLoginAt).toEqual(loginTime);
    });

    it("should suspend and reactivate user", () => {
      user.suspend();
      expect(user.isSuspended()).toBe(true);
      expect(user.isActive()).toBe(false);

      user.reactivate();
      expect(user.isActive()).toBe(true);
      expect(user.isSuspended()).toBe(false);
    });

    it("should soft delete user", () => {
      const deleteTime = new Date();
      user.softDelete(deleteTime);
      expect(user.isDeleted()).toBe(true);
      expect(user.isActive()).toBe(false);
      expect(user.deletedAt).toEqual(deleteTime);
    });

    it("should mask phone number correctly", () => {
      expect(user.maskPhone()).toBe("+880 •••• 5678");

      user.removePhone();
      expect(user.maskPhone()).toBeNull();
    });

    it("should exclude passwordHash in toSafeObject()", () => {
      const safe = user.toSafeObject();
      expect((safe as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(safe.email).toBe("farmer.john@example.com");
      expect(safe.maskedPhone).toBe("+880 •••• 5678");
    });
  });
});
