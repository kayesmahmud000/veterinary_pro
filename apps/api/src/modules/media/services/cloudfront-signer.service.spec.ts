import * as crypto from "crypto";
import { CloudFrontSignerService } from "./cloudfront-signer.service";
import { EnvService } from "../../../config/env.service";

describe("CloudFrontSignerService", () => {
  let rsaPrivateKeyPem: string;
  let rsaPublicKeyPem: string;

  beforeAll(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    rsaPrivateKeyPem = privateKey;
    rsaPublicKeyPem = publicKey;
  });

  describe("Configured Mode (Valid RSA Key Pair & Domain)", () => {
    let signerService: CloudFrontSignerService;
    let mockEnvService: Partial<EnvService>;

    beforeEach(() => {
      mockEnvService = {
        cloudfrontDistributionDomain: "cdn.vetralink.pro",
        cloudfrontKeyPairId: "K2JC3XQRI3UW74",
        cloudfrontPrivateKey: rsaPrivateKeyPem,
        cloudfrontUrlExpirationSeconds: 3600,
        port: 3001,
      };

      signerService = new CloudFrontSignerService(
        mockEnvService as EnvService
      );
    });

    it("should report isConfigured() as true", () => {
      expect(signerService.isConfigured()).toBe(true);
    });

    it("should resolve correct CDN stream base URL", () => {
      expect(signerService.getStreamBaseUrl()).toBe("https://cdn.vetralink.pro");
    });

    it("should sign URL using canned policy with proper query parameters", () => {
      const targetUrl = "https://cdn.vetralink.pro/hls/prod-1/master.m3u8";
      const signed = signerService.signUrl(targetUrl, 600);

      expect(signed).toContain("https://cdn.vetralink.pro/hls/prod-1/master.m3u8?");
      expect(signed).toContain("Expires=");
      expect(signed).toContain("Signature=");
      expect(signed).toContain("Key-Pair-Id=K2JC3XQRI3UW74");

      // Verify CloudFront URL-safe base64 (no +, =, or /)
      const urlObj = new URL(signed);
      const signature = urlObj.searchParams.get("Signature");
      expect(signature).toBeDefined();
      expect(signature).not.toMatch(/[+=/]/);
    });

    it("should sign URL using custom policy with wildcard resource pattern", () => {
      const resource = "https://cdn.vetralink.pro/hls/prod-1/*";
      const targetUrl = "https://cdn.vetralink.pro/hls/prod-1/master.m3u8";
      const signed = signerService.signUrlCustomPolicy(resource, targetUrl, 1800);

      expect(signed).toContain("https://cdn.vetralink.pro/hls/prod-1/master.m3u8?");
      expect(signed).toContain("Policy=");
      expect(signed).toContain("Signature=");
      expect(signed).toContain("Key-Pair-Id=K2JC3XQRI3UW74");

      const urlObj = new URL(signed);
      const policyParam = urlObj.searchParams.get("Policy");
      expect(policyParam).toBeDefined();

      // Decode policy from CloudFront URL-safe base64 and verify content
      const standardB64 = policyParam!
        .replace(/-/g, "+")
        .replace(/_/g, "=")
        .replace(/~/g, "/");
      const decodedPolicy = JSON.parse(
        Buffer.from(standardB64, "base64").toString("utf-8")
      );
      expect(decodedPolicy.Statement[0].Resource).toBe(resource);
      expect(decodedPolicy.Statement[0].Condition.DateLessThan["AWS:EpochTime"]).toBeDefined();
    });

    it("should generate valid signed cookies for wildcard streaming", () => {
      const resource = "https://cdn.vetralink.pro/hls/prod-1/*";
      const cookies = signerService.generateSignedCookies(resource, 3600);

      expect(cookies.keyPairId).toBe("K2JC3XQRI3UW74");
      expect(cookies.policy).toBeDefined();
      expect(cookies.signature).toBeDefined();
      expect(cookies.policy).not.toMatch(/[+=/]/);
      expect(cookies.signature).not.toMatch(/[+=/]/);

      // Verify signature validity with public key
      const standardB64Policy = cookies.policy
        .replace(/-/g, "+")
        .replace(/_/g, "=")
        .replace(/~/g, "/");
      const policyString = Buffer.from(standardB64Policy, "base64").toString("utf-8");

      const standardB64Sig = cookies.signature
        .replace(/-/g, "+")
        .replace(/_/g, "=")
        .replace(/~/g, "/");
      const sigBuffer = Buffer.from(standardB64Sig, "base64");

      const verifier = crypto.createVerify("RSA-SHA1");
      verifier.update(policyString);
      const isValid = verifier.verify(rsaPublicKeyPem, sigBuffer);
      expect(isValid).toBe(true);
    });
  });

  describe("Fallback Mode (Unconfigured Keys / Local Dev)", () => {
    let signerService: CloudFrontSignerService;
    let mockEnvService: Partial<EnvService>;

    beforeEach(() => {
      mockEnvService = {
        cloudfrontDistributionDomain: undefined,
        cloudfrontKeyPairId: undefined,
        cloudfrontPrivateKey: undefined,
        cloudfrontUrlExpirationSeconds: 3600,
        port: 3001,
      };

      signerService = new CloudFrontSignerService(
        mockEnvService as EnvService
      );
    });

    it("should report isConfigured() as false", () => {
      expect(signerService.isConfigured()).toBe(false);
    });

    it("should return localhost fallback base URL", () => {
      expect(signerService.getStreamBaseUrl()).toBe(
        "http://localhost:3001/media/stream"
      );
    });

    it("should generate mock signed URL safely without crashing", () => {
      const url = "http://localhost:3001/media/stream/hls/prod-1/master.m3u8";
      const signed = signerService.signUrl(url);

      expect(signed).toContain("Signature=dev_mock_signature");
      expect(signed).toContain("Key-Pair-Id=DEV_MOCK_KEY_ID");
    });

    it("should generate mock custom policy signed URL safely", () => {
      const resource = "http://localhost:3001/media/stream/hls/prod-1/*";
      const target = "http://localhost:3001/media/stream/hls/prod-1/master.m3u8";
      const signed = signerService.signUrlCustomPolicy(resource, target);

      expect(signed).toContain("Policy=dev_mock_policy");
      expect(signed).toContain("Signature=dev_mock_signature");
      expect(signed).toContain("Key-Pair-Id=DEV_MOCK_KEY_ID");
    });

    it("should generate mock signed cookies safely", () => {
      const cookies = signerService.generateSignedCookies("mock-resource");
      expect(cookies.policy).toBe("dev_mock_policy");
      expect(cookies.signature).toBe("dev_mock_signature");
      expect(cookies.keyPairId).toBe("DEV_MOCK_KEY_ID");
    });
  });
});
