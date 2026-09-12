import { PDFDocument } from "pdf-lib";
import { PdfWatermarkService } from "./pdf-watermark.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("PdfWatermarkService", () => {
  let service: PdfWatermarkService;
  let samplePdfBuffer: Buffer;

  beforeAll(async () => {
    // Generate a minimal valid 2-page PDF document for testing
    const doc = await PDFDocument.create();
    const page1 = doc.addPage([600, 800]);
    page1.drawText("Page 1 Sample Content");
    const page2 = doc.addPage([600, 800]);
    page2.drawText("Page 2 Sample Content");
    const pdfBytes = await doc.save();
    samplePdfBuffer = Buffer.from(pdfBytes);
  });

  beforeEach(() => {
    service = new PdfWatermarkService();
  });

  describe("applyWatermark", () => {
    it("should successfully apply dynamic watermark to all pages of a valid PDF", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Dr. John Doe",
        buyerEmail: "john.doe@dairyfarm.org",
        orderId: "ord-test-12345",
        purchaseDate: "2026-09-12T12:00:00Z",
      });

      expect(result).toBeDefined();
      expect(result.pageCount).toBe(2);
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(samplePdfBuffer.length);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

      // Verify the modified PDF is structurally valid
      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it("should accept custom watermark notice if provided", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Jane Smith",
        buyerEmail: "jane@vetclinic.com",
        orderId: "ord-custom-999",
        purchaseDate: "2026-09-12T15:30:00Z",
        customNotice: "CONFIDENTIAL VETERINARY CLINICAL PROTOCOL - LICENSED TO JANE",
      });

      expect(result.pageCount).toBe(2);
      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it("should sanitize non-ASCII Unicode characters to prevent font encoding crashes", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Dr. Björn Møller 🐮 👨‍⚕️",
        buyerEmail: "bjorn@norden.se",
        orderId: "ord-unicode-test",
        purchaseDate: "2026-09-12T12:00:00Z",
      });

      expect(result.pageCount).toBe(2);
      expect(result.pdfBuffer.length).toBeGreaterThan(0);
    });

    it("should handle single character or unusual emails gracefully", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "X",
        buyerEmail: "a@b.com",
        orderId: "ord-short-email",
        purchaseDate: "2026-09-12T12:00:00Z",
      });

      expect(result.pageCount).toBe(2);
    });

    it("should throw ValidationDomainException if pdfBuffer is empty", async () => {
      await expect(
        service.applyWatermark(Buffer.alloc(0), {
          buyerName: "Test",
          buyerEmail: "test@test.com",
          orderId: "123",
          purchaseDate: "2026-09-12",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if buffer is corrupted", async () => {
      const corruptedBuffer = Buffer.from("Not a real PDF file contents");

      await expect(
        service.applyWatermark(corruptedBuffer, {
          buyerName: "Test",
          buyerEmail: "test@test.com",
          orderId: "123",
          purchaseDate: "2026-09-12",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getPageCount", () => {
    it("should return the exact page count of a valid PDF", async () => {
      const count = await service.getPageCount(samplePdfBuffer);
      expect(count).toBe(2);
    });

    it("should throw ValidationDomainException if buffer is empty", async () => {
      await expect(service.getPageCount(Buffer.alloc(0))).rejects.toThrow(
        ValidationDomainException
      );
    });
  });
});
