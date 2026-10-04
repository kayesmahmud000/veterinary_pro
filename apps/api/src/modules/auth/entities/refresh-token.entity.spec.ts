import { RefreshTokenEntity } from "./refresh-token.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("RefreshTokenEntity", () => {
  const validProps = {
    userId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    tokenHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };

  describe("create()", () => {
    it("should instantiate a valid entity with defaults", () => {
      const entity = RefreshTokenEntity.create(validProps);

      expect(entity.id).toBeDefined();
      expect(entity.userId).toBe(validProps.userId);
      expect(entity.tokenHash).toBe(validProps.tokenHash);
      expect(entity.expiresAt).toEqual(validProps.expiresAt);
      expect(entity.ipAddress).toBe(validProps.ipAddress);
      expect(entity.userAgent).toBe(validProps.userAgent);
      expect(entity.revokedAt).toBeNull();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.isValid()).toBe(true);
      expect(entity.isRevoked()).toBe(false);
      expect(entity.isExpired()).toBe(false);
    });

    it("should allow optional fields to default to null", () => {
      const entity = RefreshTokenEntity.create({
        userId: validProps.userId,
        tokenHash: validProps.tokenHash,
        expiresAt: validProps.expiresAt,
      });

      expect(entity.ipAddress).toBeNull();
      expect(entity.userAgent).toBeNull();
    });

    it("should allow custom id if provided", () => {
      const customId = "11111111-1111-1111-1111-111111111111";
      const entity = RefreshTokenEntity.create({
        ...validProps,
        id: customId,
      });

      expect(entity.id).toBe(customId);
    });
  });

  describe("validation invariants", () => {
    it("should throw ValidationDomainException if id is empty", () => {
      expect(() =>
        RefreshTokenEntity.reconstitute({
          id: "",
          userId: validProps.userId,
          tokenHash: validProps.tokenHash,
          expiresAt: validProps.expiresAt,
          revokedAt: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if userId is empty", () => {
      expect(() =>
        RefreshTokenEntity.create({
          ...validProps,
          userId: "   ",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if tokenHash is empty", () => {
      expect(() =>
        RefreshTokenEntity.create({
          ...validProps,
          tokenHash: "",
        })
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if expiresAt is not a valid date", () => {
      expect(() =>
        RefreshTokenEntity.create({
          ...validProps,
          expiresAt: new Date("invalid-date"),
        })
      ).toThrow(ValidationDomainException);
    });
  });

  describe("lifecycle methods: isValid(), isExpired(), isRevoked(), revoke()", () => {
    it("should report expired if expiresAt is in the past", () => {
      const pastDate = new Date(Date.now() - 1000);
      const entity = RefreshTokenEntity.create({
        ...validProps,
        expiresAt: pastDate,
      });

      expect(entity.isExpired()).toBe(true);
      expect(entity.isValid()).toBe(false);
    });

    it("should report revoked and invalid after revoke() is called", () => {
      const entity = RefreshTokenEntity.create(validProps);
      expect(entity.isValid()).toBe(true);

      const revocationTime = new Date();
      entity.revoke(revocationTime);

      expect(entity.isRevoked()).toBe(true);
      expect(entity.revokedAt).toEqual(revocationTime);
      expect(entity.isValid()).toBe(false);
    });

    it("should not overwrite existing revokedAt if revoke() is called again", () => {
      const entity = RefreshTokenEntity.create(validProps);
      const firstRevoke = new Date("2026-09-01T00:00:00Z");
      const secondRevoke = new Date("2026-09-02T00:00:00Z");

      entity.revoke(firstRevoke);
      entity.revoke(secondRevoke);

      expect(entity.revokedAt).toEqual(firstRevoke);
    });
  });
});
