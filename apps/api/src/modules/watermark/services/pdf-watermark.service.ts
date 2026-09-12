import { Injectable, Logger } from "@nestjs/common";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import {
  IPdfWatermarkService,
  WatermarkOptions,
  WatermarkResult,
} from "./pdf-watermark.service.interface";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class PdfWatermarkService implements IPdfWatermarkService {
  private readonly logger = new Logger(PdfWatermarkService.name);

  public async applyWatermark(
    pdfBuffer: Buffer,
    options: WatermarkOptions
  ): Promise<WatermarkResult> {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new ValidationDomainException(
        "Cannot apply watermark: PDF buffer is empty or undefined."
      );
    }

    const startTime = Date.now();

    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });

      const pageCount = pdfDoc.getPageCount();
      if (pageCount === 0) {
        throw new ValidationDomainException(
          "PDF document contains zero pages."
        );
      }

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const cleanName = this.sanitizeText(options.buyerName);
      const maskedEmail = this.maskEmail(options.buyerEmail);
      const watermarkText =
        options.customNotice ??
        `Licensed to: ${cleanName} (${maskedEmail}) | Order #${options.orderId} | Strictly Confidential`;

      const footerText = `VETRALINK PRO SECURE DELIVERY | Purchased: ${this.sanitizeText(options.purchaseDate)} | Order: ${options.orderId}`;

      const pages = pdfDoc.getPages();

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]!;
        const { width, height } = page.getSize();

        // 1. Diagonal Running Watermark across Page Center
        const diagonalFontSize = Math.max(
          11,
          Math.min(18, Math.round(width / 45))
        );
        const textWidth = helveticaBold.widthOfTextAtSize(
          watermarkText,
          diagonalFontSize
        );

        // Center calculation with 45 degree tilt
        const centerX = width / 2;
        const centerY = height / 2;
        const rad = (45 * Math.PI) / 180;
        const offsetX = (textWidth / 2) * Math.cos(rad);
        const offsetY = (textWidth / 2) * Math.sin(rad);

        page.drawText(watermarkText, {
          x: Math.max(20, centerX - offsetX),
          y: Math.max(20, centerY - offsetY),
          size: diagonalFontSize,
          font: helveticaBold,
          color: rgb(0.65, 0.65, 0.65),
          opacity: 0.28,
          rotate: degrees(45),
        });

        // 2. Secondary Running Stamp in Upper Half
        page.drawText(watermarkText, {
          x: Math.max(20, centerX - offsetX),
          y: Math.min(height - 40, centerY - offsetY + height * 0.28),
          size: Math.max(9, diagonalFontSize - 3),
          font: helveticaBold,
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.16,
          rotate: degrees(45),
        });

        // 3. Security Footer Timestamp & Audit Stamp
        page.drawText(footerText, {
          x: 36,
          y: 18,
          size: 7.5,
          font: helveticaFont,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.65,
        });

        // 4. Page numbering indicator
        const pageIndicator = `Page ${i + 1} of ${pageCount}`;
        const pageIndicatorWidth = helveticaFont.widthOfTextAtSize(
          pageIndicator,
          7.5
        );
        page.drawText(pageIndicator, {
          x: width - 36 - pageIndicatorWidth,
          y: 18,
          size: 7.5,
          font: helveticaFont,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.65,
        });
      }

      const modifiedBytes = await pdfDoc.save();
      const executionTimeMs = Date.now() - startTime;

      this.logger.debug(
        `Watermarked ${pageCount} pages for order [${options.orderId}] in ${executionTimeMs}ms`
      );

      return {
        pdfBuffer: Buffer.from(modifiedBytes),
        pageCount,
        executionTimeMs,
      };
    } catch (error) {
      if (error instanceof ValidationDomainException) {
        throw error;
      }
      this.logger.error(
        `PDF watermarking engine error: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw new ValidationDomainException(
        `Failed to watermark PDF document: ${(error as Error).message}`
      );
    }
  }

  public async getPageCount(pdfBuffer: Buffer): Promise<number> {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new ValidationDomainException(
        "Cannot inspect page count: PDF buffer is empty or undefined."
      );
    }

    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
      });
      return pdfDoc.getPageCount();
    } catch (error) {
      throw new ValidationDomainException(
        `Failed to parse PDF page count: ${(error as Error).message}`
      );
    }
  }

  private sanitizeText(text: string): string {
    if (!text) return "";
    // Replace non-ASCII printable characters to prevent WinAnsi encoding exceptions in standard fonts
    return text.replace(/[^\x20-\x7E]/g, "?").trim();
  }

  private maskEmail(email: string): string {
    if (!email) return "***@***.***";
    const parts = email.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return this.sanitizeText(email);
    }
    const [local, domain] = parts;
    const sanitizedDomain = this.sanitizeText(domain);
    if (local.length <= 2) {
      return `${local[0] || "*"}***@${sanitizedDomain}`;
    }
    const firstChar = local[0];
    const lastChar = local[local.length - 1];
    return `${firstChar}***${lastChar}@${sanitizedDomain}`;
  }
}
