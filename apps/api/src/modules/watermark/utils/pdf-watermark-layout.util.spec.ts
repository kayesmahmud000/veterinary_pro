import {
  computePageLayoutGeometry,
  generateBuyerIntegrityHash,
  maskBuyerEmail,
  sanitizeAsciiText,
} from "./pdf-watermark-layout.util";

describe("PdfWatermarkLayoutUtil", () => {
  describe("computePageLayoutGeometry", () => {
    it("should compute accurate geometry for Portrait A4 page", () => {
      const geometry = computePageLayoutGeometry(595, 842);

      expect(geometry.width).toBe(595);
      expect(geometry.height).toBe(842);
      expect(geometry.isLandscape).toBe(false);
      expect(geometry.diagonalAngleDegrees).toBe(45);
      expect(geometry.optimalFontSize).toBeGreaterThanOrEqual(10);
      expect(geometry.optimalFontSize).toBeLessThanOrEqual(18);
      expect(geometry.upperBandOffsetY).toBeCloseTo(842 * 0.26);
      expect(geometry.lowerBandOffsetY).toBeCloseTo(-842 * 0.26);
    });

    it("should compute accurate geometry for Landscape A4 page", () => {
      const geometry = computePageLayoutGeometry(842, 595);

      expect(geometry.width).toBe(842);
      expect(geometry.height).toBe(595);
      expect(geometry.isLandscape).toBe(true);
      expect(geometry.diagonalAngleDegrees).toBe(45);
      expect(geometry.upperBandOffsetY).toBeCloseTo(595 * 0.26);
      expect(geometry.lowerBandOffsetY).toBeCloseTo(-595 * 0.26);
    });

    it("should allow custom diagonal angle when specified", () => {
      const geometry = computePageLayoutGeometry(612, 792, 30);
      expect(geometry.diagonalAngleDegrees).toBe(30);
    });
  });

  describe("generateBuyerIntegrityHash", () => {
    it("should generate a 16-character uppercase hexadecimal hash", () => {
      const hash = generateBuyerIntegrityHash(
        "buyer@dairyfarm.org",
        "ord-uuid-1234",
        "2026-09-12T12:00:00Z"
      );

      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9A-F]{16}$/);
    });

    it("should be deterministic for identical inputs", () => {
      const hash1 = generateBuyerIntegrityHash(
        "buyer@dairyfarm.org",
        "ord-uuid-1234",
        "2026-09-12T12:00:00Z"
      );
      const hash2 = generateBuyerIntegrityHash(
        "buyer@dairyfarm.org",
        "ord-uuid-1234",
        "2026-09-12T12:00:00Z"
      );

      expect(hash1).toBe(hash2);
    });

    it("should generate distinct hashes for different orders or buyers", () => {
      const hash1 = generateBuyerIntegrityHash(
        "buyer1@dairyfarm.org",
        "ord-uuid-1234",
        "2026-09-12T12:00:00Z"
      );
      const hash2 = generateBuyerIntegrityHash(
        "buyer2@dairyfarm.org",
        "ord-uuid-1234",
        "2026-09-12T12:00:00Z"
      );

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("maskBuyerEmail", () => {
    it("should mask local part preserving first and last characters", () => {
      const masked = maskBuyerEmail("dr.smith@veterinaryclinic.com");
      expect(masked).toBe("d***h@veterinaryclinic.com");
    });

    it("should mask short two-letter local part correctly", () => {
      const masked = maskBuyerEmail("ab@vetralink.pro");
      expect(masked).toBe("a***@vetralink.pro");
    });

    it("should handle single character local part correctly", () => {
      const masked = maskBuyerEmail("a@vetralink.pro");
      expect(masked).toBe("a***@vetralink.pro");
    });

    it("should handle invalid email strings gracefully", () => {
      expect(maskBuyerEmail("")).toBe("***@***.***");
      expect(maskBuyerEmail("invalid-email")).toBe("invalid-email");
    });
  });

  describe("sanitizeAsciiText", () => {
    it("should decompose accented characters to standard ASCII", () => {
      const sanitized = sanitizeAsciiText("Dr. Björn Møller");
      expect(sanitized).toBe("Dr. Bjorn M?ller");
    });

    it("should replace non-ASCII Unicode emojis with questions marks", () => {
      const sanitized = sanitizeAsciiText("Veterinarian 🐮 👨‍⚕️");
      expect(sanitized).toContain("Veterinarian");
      expect(sanitized).not.toContain("🐮");
    });

    it("should preserve standard ASCII alphanumeric and punctuation", () => {
      const input = "Licensed to: John Doe (j***e@domain.com) | Order #12345";
      expect(sanitizeAsciiText(input)).toBe(input);
    });
  });
});
