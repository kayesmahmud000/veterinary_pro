import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { PDFDocument, rgb, StandardFonts, degrees, PDFImage } from "pdf-lib";
import {
  IPdfWatermarkService,
  QrCodePlacement,
  WatermarkOptions,
  WatermarkResult,
} from "./pdf-watermark.service.interface";
import {
  IQrCodeService,
  QR_CODE_SERVICE,
} from "./qr-code.service.interface";
import { QrCodeService } from "./qr-code.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  computePageLayoutGeometry,
  generateBuyerIntegrityHash,
  maskBuyerEmail,
  sanitizeAsciiText,
} from "../utils/pdf-watermark-layout.util";

@Injectable()
export class PdfWatermarkService implements IPdfWatermarkService {
  private readonly logger = new Logger(PdfWatermarkService.name);
  private readonly qrCodeService: IQrCodeService;

  constructor(
    @Optional()
    @Inject(QR_CODE_SERVICE)
    qrCodeService?: IQrCodeService
  ) {
    this.qrCodeService = qrCodeService ?? new QrCodeService();
  }

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

      // 1. Compute Cryptographic Buyer Proof Hash
      const integrityHash =
        options.includeIntegrityHash !== false
          ? generateBuyerIntegrityHash(
              options.buyerEmail,
              options.orderId,
              options.purchaseDate
            )
          : undefined;

      // 2. Format Buyer Attribution & Security Banners
      const cleanName = sanitizeAsciiText(
        options.buyerName || "Licensed Customer"
      );
      const maskedEmail = maskBuyerEmail(
        options.buyerEmail || "customer@vetralink.pro"
      );

      const watermarkText =
        options.customNotice ??
        `Licensed to: ${cleanName} (${maskedEmail}) | Order #${options.orderId} | Strictly Confidential`;

      const warningBanner =
        "VETRALINK PRO SECURE ASSET • NON-TRANSFERABLE • COPYING PROHIBITED";

      const headerText =
        "DOCUMENT CLASSIFICATION: CONFIDENTIAL • AUTHORIZED VETERINARY COPY";

      const hashSuffix = integrityHash ? ` | Integrity: ${integrityHash}` : "";
      const footerText = `VETRALINK PRO SECURE DELIVERY | Purchased: ${sanitizeAsciiText(
        options.purchaseDate
      )} | Order: ${options.orderId}${hashSuffix}`;

      // Set Document Metadata
      pdfDoc.setAuthor("VETRALINK PRO Dynamic Anti-Piracy Watermark Engine");
      pdfDoc.setProducer("VETRALINK PRO Dynamic Anti-Piracy Watermark Engine");
      pdfDoc.setSubject(
        `Licensed to ${cleanName} (${maskedEmail}) - Order #${options.orderId}`
      );

      // 3. Generate and Embed Cryptographic Verification QR Code
      let qrCodeEmbedded = false;
      let embeddedQrImage: PDFImage | null = null;

      if (options.includeQrCode !== false) {
        const verificationUrl =
          options.verificationUrl ??
          `https://vetralink.pro/verify/license?token=${encodeURIComponent(
            options.downloadToken || options.orderId
          )}&orderId=${encodeURIComponent(options.orderId)}`;

        const qrPngBuffer = await this.qrCodeService.generateQrCodePngBuffer(
          verificationUrl,
          { width: 140, margin: 1, errorCorrectionLevel: "M" }
        );

        embeddedQrImage = await pdfDoc.embedPng(qrPngBuffer);
        qrCodeEmbedded = true;
      }

      // Calibrated Opacities & Angles
      const baseOpacity = Math.max(0.1, Math.min(0.5, options.opacity ?? 0.22));
      const secondaryOpacity = Math.max(
        0.08,
        Math.min(0.3, baseOpacity * 0.72)
      );
      const repeatDiagonal = options.repeatDiagonal !== false;

      const pages = pdfDoc.getPages();

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]!;
        const { width, height } = page.getSize();

        // Compute adaptive geometry for this page (handles Portrait vs Landscape)
        const geometry = computePageLayoutGeometry(
          width,
          height,
          options.rotationDegrees
        );

        const rad = (geometry.diagonalAngleDegrees * Math.PI) / 180;
        const centerX = width / 2;
        const centerY = height / 2;

        const textWidth = helveticaBold.widthOfTextAtSize(
          watermarkText,
          geometry.optimalFontSize
        );
        const offsetX = (textWidth / 2) * Math.cos(rad);
        const offsetY = (textWidth / 2) * Math.sin(rad);

        // 1. Primary Center Diagonal Running Watermark
        page.drawText(watermarkText, {
          x: Math.max(20, centerX - offsetX),
          y: Math.max(20, centerY - offsetY),
          size: geometry.optimalFontSize,
          font: helveticaBold,
          color: rgb(0.65, 0.65, 0.65),
          opacity: baseOpacity,
          rotate: degrees(geometry.diagonalAngleDegrees),
        });

        if (repeatDiagonal) {
          // 2. Upper-Third Secondary Identity Band (prevents bottom/center crop exploits)
          page.drawText(watermarkText, {
            x: Math.max(20, centerX - offsetX),
            y: Math.min(
              height - 40,
              centerY - offsetY + geometry.upperBandOffsetY
            ),
            size: Math.max(9, geometry.optimalFontSize - 3),
            font: helveticaBold,
            color: rgb(0.7, 0.7, 0.7),
            opacity: secondaryOpacity,
            rotate: degrees(geometry.diagonalAngleDegrees),
          });

          // 3. Lower-Third Anti-Distribution Warning Band (prevents top crop exploits)
          const warningWidth = helveticaBold.widthOfTextAtSize(
            warningBanner,
            Math.max(9, geometry.optimalFontSize - 3)
          );
          const warningOffsetX = (warningWidth / 2) * Math.cos(rad);
          const warningOffsetY = (warningWidth / 2) * Math.sin(rad);

          page.drawText(warningBanner, {
            x: Math.max(20, centerX - warningOffsetX),
            y: Math.max(
              40,
              centerY - warningOffsetY + geometry.lowerBandOffsetY
            ),
            size: Math.max(9, geometry.optimalFontSize - 3),
            font: helveticaBold,
            color: rgb(0.7, 0.7, 0.7),
            opacity: secondaryOpacity,
            rotate: degrees(geometry.diagonalAngleDegrees),
          });
        }

        // 4. Header Micro-Print Security Border
        page.drawText(headerText, {
          x: 36,
          y: height - 18,
          size: 6.5,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.5,
        });

        // 5. Verification QR Code Badge (Bottom-Right Corner)
        if (
          embeddedQrImage &&
          this.shouldDrawQrOnPage(i, pageCount, options.qrPlacement)
        ) {
          const qrSize = 42;
          const qrX = width - 36 - qrSize;
          const qrY = 28;

          page.drawImage(embeddedQrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
            opacity: 0.9,
          });

          const verifyLabel = "VERIFY";
          const labelWidth = helveticaFont.widthOfTextAtSize(verifyLabel, 5);
          page.drawText(verifyLabel, {
            x: qrX + (qrSize - labelWidth) / 2,
            y: qrY - 6,
            size: 5,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.75,
          });
        }

        // 6. Security Footer with Timestamp & SHA-256 Buyer Proof Integrity Stamp
        page.drawText(footerText, {
          x: 36,
          y: 18,
          size: 7.5,
          font: helveticaFont,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.65,
        });

        // 7. Page Counter Indicator
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
        `Watermarked ${pageCount} pages for order [${options.orderId}] in ${executionTimeMs}ms (Integrity: ${integrityHash ?? "none"}, QR: ${qrCodeEmbedded})`
      );

      return {
        pdfBuffer: Buffer.from(modifiedBytes),
        pageCount,
        executionTimeMs,
        integrityHash,
        qrCodeEmbedded,
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

  private shouldDrawQrOnPage(
    pageIndex: number,
    pageCount: number,
    placement?: QrCodePlacement
  ): boolean {
    if (!placement || placement === "all-pages") {
      return true;
    }
    if (placement === "first-page") {
      return pageIndex === 0;
    }
    if (placement === "first-and-last") {
      return pageIndex === 0 || pageIndex === pageCount - 1;
    }
    return true;
  }
}
