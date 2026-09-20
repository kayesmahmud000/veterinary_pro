import { PkiCryptoService } from "./pki-crypto.service";
import * as crypto from "crypto";

describe("PkiCryptoService", () => {
  let service: PkiCryptoService;

  beforeEach(() => {
    service = new PkiCryptoService();
    service.onModuleInit();
  });

  describe("Lifecycle & Key Initialization", () => {
    it("should generate an in-memory RSA-2048 keypair when env vars are not set", () => {
      const pubKey = service.getPublicKey();
      expect(pubKey).toBeDefined();
      expect(pubKey).toContain("BEGIN PUBLIC KEY");
      expect(pubKey).toContain("END PUBLIC KEY");
    });

    it("should use env keys when RSA_PRIVATE_KEY and RSA_PUBLIC_KEY are set", () => {
      const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env.RSA_PRIVATE_KEY = privateKey;
      process.env.RSA_PUBLIC_KEY = publicKey;

      const customService = new PkiCryptoService();
      customService.onModuleInit();

      expect(customService.getPublicKey()).toBe(publicKey.trim());

      delete process.env.RSA_PRIVATE_KEY;
      delete process.env.RSA_PUBLIC_KEY;
    });
  });

  describe("canonicalize", () => {
    it("should deterministically sort object keys regardless of original order", () => {
      const obj1 = {
        zebra: "zoo",
        apple: "red",
        nested: {
          charlie: 3,
          bravo: 2,
          alpha: 1,
        },
      };

      const obj2 = {
        apple: "red",
        nested: {
          alpha: 1,
          bravo: 2,
          charlie: 3,
        },
        zebra: "zoo",
      };

      const canonical1 = service.canonicalize(obj1);
      const canonical2 = service.canonicalize(obj2);

      expect(canonical1).toBe(canonical2);
      expect(canonical1).toBe(
        '{"apple":"red","nested":{"alpha":1,"bravo":2,"charlie":3},"zebra":"zoo"}',
      );
    });

    it("should handle arrays and primitive values properly", () => {
      const payload = {
        b: [1, { z: "last", a: "first" }, 3],
        a: "test",
      };

      const canonical = service.canonicalize(payload);
      expect(canonical).toBe(
        '{"a":"test","b":[1,{"a":"first","z":"last"},3]}',
      );
    });
  });

  describe("hash", () => {
    it("should generate a 64-character hex SHA-256 digest", () => {
      const data = "Hello, VetraLink Pro PKI!";
      const digest = service.hash(data);

      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce identical hashes for identical inputs", () => {
      const digest1 = service.hash("Test string 123");
      const digest2 = service.hash("Test string 123");
      expect(digest1).toBe(digest2);
    });

    it("should produce different hashes for modified inputs", () => {
      const digest1 = service.hash("Test string 123");
      const digest2 = service.hash("Test string 124");
      expect(digest1).not.toBe(digest2);
    });
  });

  describe("sign & verify", () => {
    it("should sign a string and verify it with the public key", () => {
      const payload = "Prescription payload for consultation #1001";
      const signature = service.sign(payload);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);

      const isValid = service.verify(payload, signature);
      expect(isValid).toBe(true);
    });

    it("should fail verification when payload has been tampered with", () => {
      const payload = "Original prescription: Amoxicillin 10mg";
      const signature = service.sign(payload);

      const tampered = "Altered prescription: Amoxicillin 50mg";
      const isValid = service.verify(tampered, signature);

      expect(isValid).toBe(false);
    });

    it("should fail verification when signature is invalid or corrupted", () => {
      const payload = "Original prescription";
      const signature = service.sign(payload);

      const corruptedSignature = signature.slice(0, -4) + "AAAA";
      const isValid = service.verify(payload, corruptedSignature);

      expect(isValid).toBe(false);
    });

    it("should return false gracefully if verification throws an error", () => {
      const isValid = service.verify("data", "not-a-valid-base64-signature!!!");
      expect(isValid).toBe(false);
    });
  });
});
