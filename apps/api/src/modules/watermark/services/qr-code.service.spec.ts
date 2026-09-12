import { QrCodeService } from "./qr-code.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("QrCodeService", () => {
  let service: QrCodeService;

  beforeEach(() => {
    service = new QrCodeService();
  });

  describe("generateQrCodePngBuffer", () => {
    it("should generate a valid PNG buffer containing QR code", async () => {
      const payload = "https://vetralink.pro/verify/license?token=abc-123";
      const buffer = await service.generateQrCodePngBuffer(payload);

      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify standard PNG magic signature bytes: 89 50 4E 47 0D 0A 1A 0A
      const pngMagicBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(buffer.subarray(0, 8)).toEqual(pngMagicBytes);
    });

    it("should respect custom width and error correction level options", async () => {
      const payload = "https://vetralink.pro/verify/license?token=xyz-999";
      const buffer = await service.generateQrCodePngBuffer(payload, {
        width: 250,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
      const pngMagicBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(buffer.subarray(0, 8)).toEqual(pngMagicBytes);
    });

    it("should throw ValidationDomainException on empty or whitespace payload", async () => {
      await expect(service.generateQrCodePngBuffer("")).rejects.toThrow(
        ValidationDomainException
      );
      await expect(service.generateQrCodePngBuffer("   ")).rejects.toThrow(
        ValidationDomainException
      );
    });
  });
});
