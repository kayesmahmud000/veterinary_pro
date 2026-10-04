import { PDFDocument } from "pdf-lib";
import { PdfWatermarkService } from "./pdf-watermark.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

describe("PdfWatermarkService", () => {
  let service: PdfWatermarkService;
  let samplePdfBuffer: Buffer;
  let mixedOrientationPdfBuffer: Buffer;

  beforeAll(async () => {
    // Generate a minimal valid 2-page PDF document for standard testing
    const doc = await PDFDocument.create();
    const page1 = doc.addPage([600, 800]);
    page1.drawText("Page 1 Sample Content");
    const page2 = doc.addPage([600, 800]);
    page2.drawText("Page 2 Sample Content");
    const pdfBytes = await doc.save();
    samplePdfBuffer = Buffer.from(pdfBytes);

    // Generate a mixed-orientation PDF document: Page 1 Portrait, Page 2 Landscape
    const mixedDoc = await PDFDocument.create();
    const portraitPage = mixedDoc.addPage([595, 842]); // A4 Portrait
    portraitPage.drawText("A4 Portrait Clinical Protocol");
    const landscapePage = mixedDoc.addPage([842, 595]); // A4 Landscape
    landscapePage.drawText("A4 Landscape Livestock Dosage Spreadsheet");
    const mixedBytes = await mixedDoc.save();
    mixedOrientationPdfBuffer = Buffer.from(mixedBytes);
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
      expect(result.integrityHash).toBeDefined();
      expect(result.integrityHash).toHaveLength(16);

      // Verify the modified PDF is structurally valid and metadata is set
      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
      expect(loadedDoc.getAuthor()).toContain("VETRALINK PRO");
      expect(loadedDoc.getSubject()).toContain("Licensed to Dr. John Doe");
    });

    it("should seamlessly handle mixed orientation documents (Portrait + Landscape)", async () => {
      const result = await service.applyWatermark(mixedOrientationPdfBuffer, {
        buyerName: "Dr. Sarah Connor",
        buyerEmail: "sarah@agrivet.com",
        orderId: "ord-mixed-777",
        purchaseDate: "2026-09-12T14:00:00Z",
        repeatDiagonal: true,
      });

      expect(result.pageCount).toBe(2);
      expect(result.integrityHash).toBeDefined();

      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      const pages = loadedDoc.getPages();
      expect(pages[0]!.getSize()).toEqual({ width: 595, height: 842 });
      expect(pages[1]!.getSize()).toEqual({ width: 842, height: 595 });
    });

    it("should accept custom opacity and rotation angle options", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Dr. Marcus Brody",
        buyerEmail: "brody@university.edu",
        orderId: "ord-options-888",
        purchaseDate: "2026-09-12T15:00:00Z",
        opacity: 0.3,
        rotationDegrees: 35,
      });

      expect(result.pageCount).toBe(2);
      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it("should omit integrity hash when includeIntegrityHash is false", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Test Buyer",
        buyerEmail: "buyer@test.org",
        orderId: "ord-no-hash",
        purchaseDate: "2026-09-12T12:00:00Z",
        includeIntegrityHash: false,
      });

      expect(result.integrityHash).toBeUndefined();
    });

    it("should allow disabling repeated secondary diagonal bands", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Single Band Buyer",
        buyerEmail: "single@farm.com",
        orderId: "ord-single-band",
        purchaseDate: "2026-09-12T12:00:00Z",
        repeatDiagonal: false,
      });

      expect(result.pageCount).toBe(2);
      expect(result.pdfBuffer.length).toBeGreaterThan(samplePdfBuffer.length);
    });

    it("should embed verification QR code by default and report qrCodeEmbedded true", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "QR Test Buyer",
        buyerEmail: "qr@farm.org",
        orderId: "ord-qr-123",
        purchaseDate: "2026-09-12T12:00:00Z",
        downloadToken: "tok-abc-uuid-1234",
      });

      expect(result.qrCodeEmbedded).toBe(true);
      const loadedDoc = await PDFDocument.load(result.pdfBuffer);
      expect(loadedDoc.getPageCount()).toBe(2);
    });

    it("should honor qrPlacement first-page and first-and-last options", async () => {
      const firstPageResult = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "First Page QR Buyer",
        buyerEmail: "first@farm.org",
        orderId: "ord-first-qr",
        purchaseDate: "2026-09-12T12:00:00Z",
        qrPlacement: "first-page",
      });
      expect(firstPageResult.qrCodeEmbedded).toBe(true);

      const firstAndLastResult = await service.applyWatermark(
        samplePdfBuffer,
        {
          buyerName: "First & Last QR Buyer",
          buyerEmail: "last@farm.org",
          orderId: "ord-last-qr",
          purchaseDate: "2026-09-12T12:00:00Z",
          qrPlacement: "first-and-last",
        }
      );
      expect(firstAndLastResult.qrCodeEmbedded).toBe(true);
    });

    it("should omit QR code when includeQrCode is false", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "No QR Buyer",
        buyerEmail: "noqr@farm.org",
        orderId: "ord-no-qr",
        purchaseDate: "2026-09-12T12:00:00Z",
        includeQrCode: false,
      });

      expect(result.qrCodeEmbedded).toBe(false);
    });

    it("should accept custom watermark notice if provided", async () => {
      const result = await service.applyWatermark(samplePdfBuffer, {
        buyerName: "Jane Smith",
        buyerEmail: "jane@vetclinic.com",
        orderId: "ord-custom-999",
        purchaseDate: "2026-09-12T15:30:00Z",
        customNotice:
          "CONFIDENTIAL VETERINARY CLINICAL PROTOCOL - LICENSED TO JANE",
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
