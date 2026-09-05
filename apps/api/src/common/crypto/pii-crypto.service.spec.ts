import { Test, TestingModule } from "@nestjs/testing";
import { PiiCryptoService } from "./pii-crypto.service";
import { EnvService } from "../../config/env.service";
import { PiiCryptoException } from "./exceptions/pii-crypto.exception";

describe("PiiCryptoService", () => {
  let service: PiiCryptoService;

  const validKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const validPepper = "test_dev_hash_pepper_key_16";

  const mockEnvService = {
    aesPiiEncryptionKey: validKey,
    hashPepper: validPepper,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiiCryptoService,
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
      ],
    }).compile();

    service = module.get<PiiCryptoService>(PiiCryptoService);
  });

  describe("Initialization & Validation", () => {
    it("should be defined with valid configuration", () => {
      expect(service).toBeDefined();
    });

    it("should throw PiiCryptoException if AES key is not 64 hex characters", () => {
      const invalidEnv = {
        aesPiiEncryptionKey: "too_short_key",
        hashPepper: validPepper,
      };

      expect(
        () => new PiiCryptoService(invalidEnv as unknown as EnvService)
      ).toThrow(PiiCryptoException);
    });

    it("should throw PiiCryptoException if HASH_PEPPER is shorter than 16 chars", () => {
      const invalidEnv = {
        aesPiiEncryptionKey: validKey,
        hashPepper: "short_pepper",
      };

      expect(
        () => new PiiCryptoService(invalidEnv as unknown as EnvService)
      ).toThrow(PiiCryptoException);
    });
  });

  describe("AES-256-GCM Encryption & Decryption", () => {
    const samplePhone = "+12025550199";

    it("should encrypt plaintext into <iv>:<authTag>:<ciphertext> format", () => {
      const encrypted = service.encrypt(samplePhone);

      expect(typeof encrypted).toBe("string");
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);

      const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];
      // 16 bytes = 32 hex chars
      expect(ivHex.length).toBe(32);
      // 16 bytes auth tag = 32 hex chars
      expect(authTagHex.length).toBe(32);
      expect(cipherHex.length).toBeGreaterThan(0);
    });

    it("should decrypt ciphertext back to the original plaintext", () => {
      const encrypted = service.encrypt(samplePhone);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(samplePhone);
    });

    it("should ensure semantic security (same plaintext produces different ciphertexts)", () => {
      const enc1 = service.encrypt(samplePhone);
      const enc2 = service.encrypt(samplePhone);

      expect(enc1).not.toBe(enc2);
      expect(service.decrypt(enc1)).toBe(samplePhone);
      expect(service.decrypt(enc2)).toBe(samplePhone);
    });

    it("should correctly handle Unicode/UTF-8 strings", () => {
      const unicodeString = "ফার্ম-ম্যানেজার-০১৭১২৩৪৫৬৭৮";
      const encrypted = service.encrypt(unicodeString);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(unicodeString);
    });

    it("should throw PiiCryptoException on empty plaintext", () => {
      expect(() => service.encrypt("")).toThrow(PiiCryptoException);
    });

    it("should throw PiiCryptoException on empty or invalid ciphertext format", () => {
      expect(() => service.decrypt("")).toThrow(PiiCryptoException);
      expect(() => service.decrypt("invalid-ciphertext-format")).toThrow(
        PiiCryptoException
      );
      expect(() => service.decrypt("part1:part2")).toThrow(PiiCryptoException);
    });

    it("should detect tampering in ciphertext payload and throw PiiCryptoException", () => {
      const encrypted = service.encrypt(samplePhone);
      const [iv, authTag, cipherHex] = encrypted.split(":");

      // Flip the last character of the ciphertext
      const tamperedChar = cipherHex.endsWith("a") ? "b" : "a";
      const tamperedCipher = cipherHex.slice(0, -1) + tamperedChar;
      const tamperedPayload = `${iv}:${authTag}:${tamperedCipher}`;

      expect(() => service.decrypt(tamperedPayload)).toThrow(PiiCryptoException);
    });

    it("should detect tampering in auth tag and throw PiiCryptoException", () => {
      const encrypted = service.encrypt(samplePhone);
      const [iv, authTag, cipherHex] = encrypted.split(":");

      // Flip auth tag
      const tamperedTag =
        authTag.slice(0, -1) + (authTag.endsWith("f") ? "0" : "f");
      const tamperedPayload = `${iv}:${tamperedTag}:${cipherHex}`;

      expect(() => service.decrypt(tamperedPayload)).toThrow(PiiCryptoException);
    });
  });

  describe("Phone Normalization", () => {
    it("should strip spaces, dashes, and parentheses while preserving leading +", () => {
      expect(service.normalizePhone("+1 (202) 555-0100")).toBe("+12025550100");
      expect(service.normalizePhone("+880 1711-223344")).toBe("+8801711223344");
      expect(service.normalizePhone("  01711.223.344  ")).toBe("01711223344");
    });

    it("should throw PiiCryptoException when input has no digits", () => {
      expect(() => service.normalizePhone("   ")).toThrow(PiiCryptoException);
      expect(() => service.normalizePhone("abc")).toThrow(PiiCryptoException);
    });
  });

  describe("HMAC-SHA256 Blind Indexing", () => {
    it("should generate deterministic hashes for equivalent phone formats", () => {
      const hash1 = service.hashPhone("+1 (202) 555-0100");
      const hash2 = service.hashPhone("+12025550100");
      const hash3 = service.hashPhone(" +1 202-555-0100 ");

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      // 32 bytes = 64 hex characters
      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
    });

    it("should generate distinct hashes for different phone numbers", () => {
      const hashA = service.hashPhone("+12025550101");
      const hashB = service.hashPhone("+12025550102");

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Phone Masking", () => {
    it("should mask intermediate digits for privacy", () => {
      const masked = service.maskPhone("+8801711223344");
      expect(masked).toContain("••••");
      expect(masked).toContain("3344");
      expect(masked.startsWith("+880")).toBe(true);
    });

    it("should handle short numbers gracefully", () => {
      expect(service.maskPhone("123")).toBe("123");
    });
  });
});
