import { Injectable, Logger } from "@nestjs/common";
import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  RGB,
  PDFPage,
  PDFFont,
} from "pdf-lib";
import * as QRCode from "qrcode";
import {
  IPrescriptionPdfService,
  PrescriptionPdfData,
} from "./prescription-pdf.service.interface";

@Injectable()
export class PrescriptionPdfService implements IPrescriptionPdfService {
  private readonly logger = new Logger(PrescriptionPdfService.name);

  // Color Palette
  private readonly PRIMARY_COLOR = rgb(0.08, 0.38, 0.28); // Deep forest / clinic green
  private readonly SECONDARY_COLOR = rgb(0.18, 0.24, 0.32); // Slate navy
  private readonly TEXT_DARK = rgb(0.12, 0.14, 0.17); // Near black
  private readonly TEXT_MUTED = rgb(0.42, 0.46, 0.52); // Muted gray
  private readonly BG_LIGHT = rgb(0.96, 0.97, 0.98); // Light gray box
  private readonly WARNING_BG = rgb(1.0, 0.97, 0.92); // Light amber
  private readonly WARNING_BORDER = rgb(0.85, 0.55, 0.15); // Amber border
  private readonly LINE_COLOR = rgb(0.85, 0.88, 0.92); // Divider line

  public async generatePrescriptionPdf(
    data: PrescriptionPdfData,
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle(`Prescription - ${data.prescriptionId}`);
      pdfDoc.setAuthor(data.vetName);
      pdfDoc.setSubject(`Veterinary Prescription for ${data.animalTag}`);
      pdfDoc.setCreator("VetraLink Pro Telehealth Platform");

      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

      // Generate QR Code PNG Buffer
      const qrPngBuffer = await QRCode.toBuffer(data.verifyUrl, {
        type: "png",
        width: 180,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      const qrImage = await pdfDoc.embedPng(qrPngBuffer);

      let page = pdfDoc.addPage(PageSizes.A4);
      const { width, height } = page.getSize();
      const margin = 40;
      const contentWidth = width - margin * 2;
      let currentY = height - margin;

      const ensureSpace = (neededHeight: number): void => {
        if (currentY - neededHeight < margin + 40) {
          page = pdfDoc.addPage(PageSizes.A4);
          currentY = height - margin;
          // Add continuation header
          page.drawText("VETRALINK PRO — PRESCRIPTION (CONTINUED)", {
            x: margin,
            y: currentY,
            size: 9,
            font: fontBold,
            color: this.TEXT_MUTED,
          });
          currentY -= 20;
        }
      };

      // 1. Clinic Letterhead Header
      page.drawRectangle({
        x: margin,
        y: currentY - 50,
        width: contentWidth,
        height: 50,
        color: this.PRIMARY_COLOR,
      });

      page.drawText("VETRALINK PRO CLINICAL TELEHEALTH", {
        x: margin + 14,
        y: currentY - 24,
        size: 16,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(
        "OFFICIAL DIGITAL VETERINARY PRESCRIPTION & MEDICAL ORDER",
        {
          x: margin + 14,
          y: currentY - 40,
          size: 8,
          font: fontRegular,
          color: rgb(0.85, 0.94, 0.9),
        },
      );

      currentY -= 65;

      // 2. Metadata Grid (2 Columns: Vet/Consultation vs Farm/Animal)
      const colWidth = (contentWidth - 20) / 2;
      const metaBoxHeight = 100;

      // Left Box: Clinical & Vet Info
      page.drawRectangle({
        x: margin,
        y: currentY - metaBoxHeight,
        width: colWidth,
        height: metaBoxHeight,
        color: this.BG_LIGHT,
      });

      let leftY = currentY - 18;
      const drawField = (
        p: PDFPage,
        label: string,
        val: string,
        x: number,
        y: number,
        maxLen = 32,
      ) => {
        p.drawText(label, {
          x,
          y,
          size: 8,
          font: fontBold,
          color: this.TEXT_MUTED,
        });
        const truncated =
          val.length > maxLen ? `${val.slice(0, maxLen)}...` : val;
        p.drawText(truncated, {
          x: x + 85,
          y,
          size: 8.5,
          font: fontRegular,
          color: this.TEXT_DARK,
        });
      };

      drawField(
        page,
        "Consultation Ref:",
        data.consultationId.slice(0, 18),
        margin + 10,
        leftY,
      );
      leftY -= 16;
      drawField(
        page,
        "Prescription ID:",
        data.prescriptionId.slice(0, 18),
        margin + 10,
        leftY,
      );
      leftY -= 16;
      drawField(
        page,
        "Issued / Signed:",
        new Date(data.signedAt).toLocaleString(),
        margin + 10,
        leftY,
      );
      leftY -= 16;
      drawField(
        page,
        "Attending Vet:",
        data.vetName,
        margin + 10,
        leftY,
      );
      leftY -= 16;
      drawField(
        page,
        "Vet License #:",
        data.vetLicenseNumber,
        margin + 10,
        leftY,
      );

      // Right Box: Farm & Animal Info
      const rightX = margin + colWidth + 20;
      page.drawRectangle({
        x: rightX,
        y: currentY - metaBoxHeight,
        width: colWidth,
        height: metaBoxHeight,
        color: this.BG_LIGHT,
      });

      let rightY = currentY - 18;
      drawField(page, "Farm / Tenant:", data.farmName, rightX + 10, rightY);
      rightY -= 16;
      drawField(page, "Farmer / Owner:", data.farmerName, rightX + 10, rightY);
      rightY -= 16;
      drawField(
        page,
        "Animal Tag:",
        data.animalTag,
        rightX + 10,
        rightY,
      );
      rightY -= 16;
      drawField(
        page,
        "Species / Breed:",
        data.animalSpecies,
        rightX + 10,
        rightY,
      );
      rightY -= 16;
      drawField(
        page,
        "Animal Name:",
        data.animalName || "N/A",
        rightX + 10,
        rightY,
      );

      currentY -= metaBoxHeight + 15;

      // 3. Clinical Diagnosis & Clinical Notes
      page.drawText("CLINICAL DIAGNOSIS & OBSERVATIONS", {
        x: margin,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: this.SECONDARY_COLOR,
      });
      currentY -= 14;

      const diagBoxHeight = data.notes ? 48 : 32;
      page.drawRectangle({
        x: margin,
        y: currentY - diagBoxHeight,
        width: contentWidth,
        height: diagBoxHeight,
        borderColor: this.LINE_COLOR,
        borderWidth: 1,
        color: rgb(0.99, 0.99, 1.0),
      });

      page.drawText(`Diagnosis: ${data.diagnosis}`, {
        x: margin + 10,
        y: currentY - 16,
        size: 9,
        font: fontBold,
        color: this.TEXT_DARK,
      });

      if (data.notes) {
        page.drawText(`Clinical Notes: ${data.notes.slice(0, 100)}`, {
          x: margin + 10,
          y: currentY - 32,
          size: 8,
          font: fontOblique,
          color: this.TEXT_MUTED,
        });
      }

      currentY -= diagBoxHeight + 18;

      // 4. Structured Rx Medications Table
      page.drawText("PRESCRIBED MEDICATIONS & DOSAGE REGIMEN (Rx)", {
        x: margin,
        y: currentY,
        size: 9.5,
        font: fontBold,
        color: this.SECONDARY_COLOR,
      });
      currentY -= 14;

      // Table Header
      const tableHeaderHeight = 22;
      page.drawRectangle({
        x: margin,
        y: currentY - tableHeaderHeight,
        width: contentWidth,
        height: tableHeaderHeight,
        color: this.SECONDARY_COLOR,
      });

      const colDrugX = margin + 8;
      const colRouteX = margin + 160;
      const colFreqX = margin + 280;
      const colDurX = margin + 370;
      const colWithdX = margin + 430;

      const drawHeader = (text: string, x: number) => {
        page.drawText(text, {
          x,
          y: currentY - 15,
          size: 7.5,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      };

      drawHeader("DRUG & FORMULATION", colDrugX);
      drawHeader("ROUTE & DOSAGE", colRouteX);
      drawHeader("FREQUENCY", colFreqX);
      drawHeader("DURATION", colDurX);
      drawHeader("WITHDRAWAL", colWithdX);

      currentY -= tableHeaderHeight;

      // Table Rows
      for (let i = 0; i < data.medications.length; i++) {
        const med = data.medications[i];
        const rowHeight = med.instructions ? 34 : 26;
        ensureSpace(rowHeight + 10);

        const rowBg = i % 2 === 0 ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1);
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rowBg,
          borderColor: this.LINE_COLOR,
          borderWidth: 0.5,
        });

        // Drug Name + Formulation
        page.drawText(med.name.slice(0, 24), {
          x: colDrugX,
          y: currentY - 12,
          size: 8,
          font: fontBold,
          color: this.TEXT_DARK,
        });
        page.drawText(`(${med.formulation})`, {
          x: colDrugX,
          y: currentY - 22,
          size: 7,
          font: fontRegular,
          color: this.TEXT_MUTED,
        });

        // Route & Dosage
        page.drawText(`${med.dosage}`, {
          x: colRouteX,
          y: currentY - 12,
          size: 8,
          font: fontRegular,
          color: this.TEXT_DARK,
        });
        page.drawText(`${med.route}`, {
          x: colRouteX,
          y: currentY - 22,
          size: 7,
          font: fontRegular,
          color: this.TEXT_MUTED,
        });

        // Frequency
        page.drawText(med.frequency, {
          x: colFreqX,
          y: currentY - 14,
          size: 8,
          font: fontRegular,
          color: this.TEXT_DARK,
        });

        // Duration
        page.drawText(`${med.durationDays} day(s)`, {
          x: colDurX,
          y: currentY - 14,
          size: 8,
          font: fontRegular,
          color: this.TEXT_DARK,
        });

        // Withdrawal
        const milkW = med.withdrawalDaysMilk ?? 0;
        const meatW = med.withdrawalDaysMeat ?? 0;
        const maxW = med.withdrawalDays ?? Math.max(milkW, meatW);
        const wText =
          maxW > 0
            ? `Milk: ${milkW}d | Meat: ${meatW}d`
            : "0 days (None)";

        page.drawText(wText, {
          x: colWithdX,
          y: currentY - 14,
          size: 7,
          font: maxW > 0 ? fontBold : fontRegular,
          color: maxW > 0 ? rgb(0.8, 0.2, 0.1) : this.TEXT_MUTED,
        });

        currentY -= rowHeight;
      }

      currentY -= 15;

      // 5. Food Safety & Withdrawal Period Alert Box (if applicable)
      if (data.withdrawalDays > 0) {
        ensureSpace(50);
        page.drawRectangle({
          x: margin,
          y: currentY - 44,
          width: contentWidth,
          height: 44,
          color: this.WARNING_BG,
          borderColor: this.WARNING_BORDER,
          borderWidth: 1,
        });

        page.drawText("FOOD SAFETY WARNING: ACTIVE WITHDRAWAL PERIOD", {
          x: margin + 12,
          y: currentY - 16,
          size: 8.5,
          font: fontBold,
          color: rgb(0.65, 0.35, 0.05),
        });

        const milkTxt = data.withdrawalDaysMilk ? `${data.withdrawalDaysMilk} days` : "N/A";
        const meatTxt = data.withdrawalDaysMeat ? `${data.withdrawalDaysMeat} days` : "N/A";

        page.drawText(
          `Milk Withdrawal: ${milkTxt} | Meat Withdrawal: ${meatTxt} | Minimum safe harvest clearance: ${data.withdrawalDays} days from last dose.`,
          {
            x: margin + 12,
            y: currentY - 32,
            size: 7.5,
            font: fontRegular,
            color: this.TEXT_DARK,
          },
        );

        currentY -= 55;
      }

      // 6. PKI Digital Signature & Verification QR Code Section
      ensureSpace(90);
      page.drawRectangle({
        x: margin,
        y: currentY - 80,
        width: contentWidth,
        height: 80,
        color: this.BG_LIGHT,
        borderColor: this.LINE_COLOR,
        borderWidth: 1,
      });

      // Draw QR Code
      const qrSize = 64;
      page.drawImage(qrImage, {
        x: margin + 10,
        y: currentY - 72,
        width: qrSize,
        height: qrSize,
      });

      // Signature Information
      const sigX = margin + 85;
      let sigY = currentY - 18;

      page.drawText("CRYPTOGRAPHICALLY VERIFIED & DIGITALLY SIGNED", {
        x: sigX,
        y: sigY,
        size: 8.5,
        font: fontBold,
        color: this.PRIMARY_COLOR,
      });
      sigY -= 14;

      page.drawText("Algorithm: RSA-SHA256 (Asymmetric PKI Signature)", {
        x: sigX,
        y: sigY,
        size: 7.5,
        font: fontRegular,
        color: this.TEXT_DARK,
      });
      sigY -= 12;

      const sigShort = `${data.digitalSignatureHash.slice(0, 36)}...${data.digitalSignatureHash.slice(-16)}`;
      page.drawText(`Signature Stamp: ${sigShort}`, {
        x: sigX,
        y: sigY,
        size: 6.5,
        font: fontMono,
        color: this.TEXT_MUTED,
      });
      sigY -= 12;

      page.drawText(`Verification URL: ${data.verifyUrl}`, {
        x: sigX,
        y: sigY,
        size: 7,
        font: fontRegular,
        color: this.PRIMARY_COLOR,
      });
      sigY -= 12;

      page.drawText(
        "Scan the QR code to verify cryptographic authenticity on the public verification portal.",
        {
          x: sigX,
          y: sigY,
          size: 6.5,
          font: fontOblique,
          color: this.TEXT_MUTED,
        },
      );

      // Save PDF Document as Buffer
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(
        `Failed to generate prescription PDF for prescription '${data.prescriptionId}': ${error}`,
      );
      throw error;
    }
  }
}
