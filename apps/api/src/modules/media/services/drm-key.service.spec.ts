import { Test, TestingModule } from "@nestjs/testing";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DrmKeyService } from "./drm-key.service";
import { EnvService } from "../../../config/env.service";

describe("DrmKeyService (Unit)", () => {
  let service: DrmKeyService;
  let mockEnvService: { hlsDrmKeySecret: string };
  let tempDir: string;

  beforeEach(async () => {
    mockEnvService = {
      hlsDrmKeySecret: "dev_hls_drm_key_master_secret_32_chars_long",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrmKeyService,
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
      ],
    }).compile();

    service = module.get<DrmKeyService>(DrmKeyService);
  });

  afterEach(async () => {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  describe("deriveKey", () => {
    it("should return a 16-byte Buffer", () => {
      const productId = "11111111-1111-4111-8111-111111111111";
      const key = service.deriveKey(productId);

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(16);
    });

    it("should be deterministic for the same productId and secret", () => {
      const productId = "11111111-1111-4111-8111-111111111111";
      const key1 = service.deriveKey(productId);
      const key2 = service.deriveKey(productId);

      expect(key1).toEqual(key2);
      expect(key1.toString("hex")).toBe(key2.toString("hex"));
    });

    it("should derive distinct keys for different productIds", () => {
      const prod1 = "11111111-1111-4111-8111-111111111111";
      const prod2 = "22222222-2222-4222-8222-222222222222";

      const key1 = service.deriveKey(prod1);
      const key2 = service.deriveKey(prod2);

      expect(key1).not.toEqual(key2);
    });

    it("should derive distinct keys if the master secret changes", () => {
      const productId = "11111111-1111-4111-8111-111111111111";
      const key1 = service.deriveKey(productId);

      mockEnvService.hlsDrmKeySecret = "another_secret_key_minimum_32_characters_long";
      const key2 = service.deriveKey(productId);

      expect(key1).not.toEqual(key2);
    });
  });

  describe("generateKeyInfoFile", () => {
    it("should generate valid video.key and video.keyinfo files", async () => {
      const { mkdir } = await import("node:fs/promises");
      tempDir = join(tmpdir(), `drm-key-test-${randomUUID()}`);
      await mkdir(tempDir, { recursive: true });

      const productId = "11111111-1111-4111-8111-111111111111";
      const keyUrl = "https://api.vetralink.pro/api/v1/media/drm/key/token-123";

      const keyInfoPath = await service.generateKeyInfoFile(
        productId,
        keyUrl,
        tempDir
      );

      expect(keyInfoPath).toBe(join(tempDir, "video.keyinfo"));

      // Verify key file contents
      const keyPath = join(tempDir, "video.key");
      const keyContent = await readFile(keyPath);
      expect(keyContent.length).toBe(16);
      expect(keyContent).toEqual(service.deriveKey(productId));

      // Verify keyinfo file contents
      const keyInfoContent = await readFile(keyInfoPath, "utf-8");
      const lines = keyInfoContent.split("\n");
      expect(lines[0]).toBe(keyUrl);
      expect(lines[1]).toBe(keyPath);
    });
  });
});
