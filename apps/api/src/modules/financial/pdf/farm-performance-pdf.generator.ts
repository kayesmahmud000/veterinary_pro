import { Injectable, Logger } from "@nestjs/common";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { MonthlyPerformanceStatementDto } from "@vetralink/shared-types";

@Injectable()
export class FarmPerformancePdfGenerator {
  private readonly logger = new Logger(FarmPerformancePdfGenerator.name);

  public async generatePdf(
    statement: MonthlyPerformanceStatementDto
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    // A4 geometry in points: 595.28 x 841.89
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Color palette
    const colorPrimary = rgb(0.08, 0.35, 0.22); // Forest green
    const colorCharcoal = rgb(0.15, 0.15, 0.15);
    const colorMuted = rgb(0.45, 0.45, 0.45);
    const colorGreen = rgb(0.12, 0.55, 0.25);
    const colorRed = rgb(0.8, 0.15, 0.15);
    const colorLightBg = rgb(0.95, 0.97, 0.95);
    const colorBorder = rgb(0.85, 0.88, 0.85);

    // 1. Top Header Banner
    page.drawRectangle({
      x: 0,
      y: pageHeight - 75,
      width: pageWidth,
      height: 75,
      color: colorPrimary,
    });

    page.drawText("VETRALINK PRO", {
      x: margin,
      y: pageHeight - 35,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText("MONTHLY FARM PERFORMANCE & FINANCIAL STATEMENT", {
      x: margin,
      y: pageHeight - 55,
      size: 10,
      font: fontRegular,
      color: rgb(0.85, 0.92, 0.88),
    });

    // 2. Farm Details & Period Meta (y: ~730 down to 670)
    let curY = pageHeight - 105;

    page.drawText(statement.farm.name.toUpperCase(), {
      x: margin,
      y: curY,
      size: 14,
      font: fontBold,
      color: colorCharcoal,
    });

    curY -= 16;
    page.drawText(
      `Farm Code: ${statement.farm.slug}  |  Type: ${statement.farm.farmType}  |  Country: ${statement.farm.country}`,
      {
        x: margin,
        y: curY,
        size: 9,
        font: fontRegular,
        color: colorMuted,
      }
    );

    // Period Badge on right
    const periodText = `Period: ${statement.period.startDate} to ${statement.period.endDate}`;
    const periodWidth = fontBold.widthOfTextAtSize(periodText, 9);
    page.drawText(periodText, {
      x: pageWidth - margin - periodWidth,
      y: curY + 16,
      size: 9,
      font: fontBold,
      color: colorPrimary,
    });

    const currText = `Currency: ${statement.farm.currency}`;
    const currWidth = fontRegular.widthOfTextAtSize(currText, 9);
    page.drawText(currText, {
      x: pageWidth - margin - currWidth,
      y: curY,
      size: 9,
      font: fontRegular,
      color: colorMuted,
    });

    // Horizontal Divider
    curY -= 14;
    page.drawLine({
      start: { x: margin, y: curY },
      end: { x: pageWidth - margin, y: curY },
      thickness: 1,
      color: colorBorder,
    });

    // 3. Section: Executive Financial Summary (KPI Tile Box)
    curY -= 20;
    page.drawText("1. EXECUTIVE FINANCIAL SUMMARY", {
      x: margin,
      y: curY,
      size: 10,
      font: fontBold,
      color: colorPrimary,
    });

    curY -= 65;
    page.drawRectangle({
      x: margin,
      y: curY,
      width: contentWidth,
      height: 55,
      color: colorLightBg,
      borderColor: colorBorder,
      borderWidth: 1,
    });

    const colW = contentWidth / 5;
    const kpiMetrics = [
      {
        label: "GROSS REVENUE",
        value: `${statement.financialSummary.totalRevenue.toLocaleString()} ${statement.farm.currency}`,
        color: colorGreen,
      },
      {
        label: "OPERATING EXPENSES",
        value: `${statement.financialSummary.totalExpense.toLocaleString()} ${statement.farm.currency}`,
        color: colorCharcoal,
      },
      {
        label: "NET PROFIT / LOSS",
        value: `${statement.financialSummary.netProfit.toLocaleString()} ${statement.farm.currency}`,
        color:
          statement.financialSummary.netProfit >= 0 ? colorGreen : colorRed,
      },
      {
        label: "PROFIT MARGIN",
        value: `${statement.financialSummary.profitMarginPercentage}%`,
        color:
          statement.financialSummary.profitMarginPercentage >= 0
            ? colorGreen
            : colorRed,
      },
      {
        label: "OPEX RATIO",
        value: `${statement.financialSummary.operatingExpenseRatio}%`,
        color: colorCharcoal,
      },
    ];

    for (let i = 0; i < kpiMetrics.length; i++) {
      const k = kpiMetrics[i]!;
      const kX = margin + i * colW + 8;
      page.drawText(k.label, {
        x: kX,
        y: curY + 36,
        size: 7,
        font: fontBold,
        color: colorMuted,
      });
      page.drawText(k.value, {
        x: kX,
        y: curY + 16,
        size: 9,
        font: fontBold,
        color: k.color,
      });
    }

    // 4. Section: Category Breakdowns (Side by Side)
    curY -= 25;
    page.drawText("2. REVENUE & EXPENSE ALLOCATION", {
      x: margin,
      y: curY,
      size: 10,
      font: fontBold,
      color: colorPrimary,
    });

    curY -= 15;
    const tableW = (contentWidth - 15) / 2;

    // Left Box: Revenue Breakdown
    page.drawRectangle({
      x: margin,
      y: curY - 110,
      width: tableW,
      height: 110,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: margin,
      y: curY - 20,
      width: tableW,
      height: 20,
      color: colorLightBg,
    });

    page.drawText("REVENUE STREAMS", {
      x: margin + 8,
      y: curY - 14,
      size: 8,
      font: fontBold,
      color: colorPrimary,
    });

    let revY = curY - 34;
    const revItems = statement.revenueBreakdown.slice(0, 4);
    if (revItems.length === 0) {
      page.drawText("No revenue transactions recorded", {
        x: margin + 8,
        y: revY,
        size: 8,
        font: fontRegular,
        color: colorMuted,
      });
    } else {
      for (const r of revItems) {
        page.drawText(`${r.category}:`, {
          x: margin + 8,
          y: revY,
          size: 8,
          font: fontRegular,
          color: colorCharcoal,
        });
        const amtStr = `${r.amount.toLocaleString()} ${statement.farm.currency} (${r.percentage}%)`;
        const aW = fontBold.widthOfTextAtSize(amtStr, 8);
        page.drawText(amtStr, {
          x: margin + tableW - aW - 8,
          y: revY,
          size: 8,
          font: fontBold,
          color: colorCharcoal,
        });
        revY -= 18;
      }
    }

    // Right Box: Expense Breakdown
    const rightX = margin + tableW + 15;
    page.drawRectangle({
      x: rightX,
      y: curY - 110,
      width: tableW,
      height: 110,
      color: rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: rightX,
      y: curY - 20,
      width: tableW,
      height: 20,
      color: colorLightBg,
    });

    page.drawText("EXPENSE CATEGORIES", {
      x: rightX + 8,
      y: curY - 14,
      size: 8,
      font: fontBold,
      color: colorPrimary,
    });

    let expY = curY - 34;
    const expItems = statement.expenseBreakdown.slice(0, 4);
    if (expItems.length === 0) {
      page.drawText("No expense transactions recorded", {
        x: rightX + 8,
        y: expY,
        size: 8,
        font: fontRegular,
        color: colorMuted,
      });
    } else {
      for (const e of expItems) {
        page.drawText(`${e.category}:`, {
          x: rightX + 8,
          y: expY,
          size: 8,
          font: fontRegular,
          color: colorCharcoal,
        });
        const amtStr = `${e.amount.toLocaleString()} ${statement.farm.currency} (${e.percentage}%)`;
        const aW = fontBold.widthOfTextAtSize(amtStr, 8);
        page.drawText(amtStr, {
          x: rightX + tableW - aW - 8,
          y: expY,
          size: 8,
          font: fontBold,
          color: colorCharcoal,
        });
        expY -= 18;
      }
    }

    // 5. Section: Dairy Production & Cost-Per-Liter (CPL)
    curY -= 135;
    page.drawText("3. DAIRY OUTPUT & COST-PER-LITER (CPL) ECONOMICS", {
      x: margin,
      y: curY,
      size: 10,
      font: fontBold,
      color: colorPrimary,
    });

    curY -= 75;
    page.drawRectangle({
      x: margin,
      y: curY,
      width: contentWidth,
      height: 65,
      color: colorLightBg,
      borderColor: colorBorder,
      borderWidth: 1,
    });

    const d = statement.dairyMetrics;
    const dairyCols = [
      {
        l: "TOTAL MILK YIELD",
        v: `${d.totalMilkYieldLiters.toLocaleString()} Liters`,
      },
      {
        l: "DAILY AVG YIELD",
        v: `${d.averageDailyYieldLiters.toLocaleString()} L/day`,
      },
      {
        l: "FEED COST / LITER",
        v: `${d.feedCostPerLiter} ${statement.farm.currency}/L`,
      },
      {
        l: "TOTAL OPEX / LITER",
        v: `${d.operatingCostPerLiter} ${statement.farm.currency}/L`,
      },
      {
        l: "NET MARGIN / LITER",
        v: `${d.netMarginPerLiter >= 0 ? "+" : ""}${d.netMarginPerLiter} ${statement.farm.currency}/L`,
        c: d.isProfitablePerLiter ? colorGreen : colorRed,
      },
    ];

    const dColW = contentWidth / 5;
    for (let i = 0; i < dairyCols.length; i++) {
      const col = dairyCols[i]!;
      const dX = margin + i * dColW + 8;
      page.drawText(col.l, {
        x: dX,
        y: curY + 44,
        size: 7,
        font: fontBold,
        color: colorMuted,
      });
      page.drawText(col.v, {
        x: dX,
        y: curY + 20,
        size: 9,
        font: fontBold,
        color: col.c ?? colorCharcoal,
      });
    }

    // 6. Section: Feed Efficiency & Livestock FCR
    curY -= 25;
    page.drawText("4. FEED CONVERSION & BIOLOGICAL EFFICIENCY", {
      x: margin,
      y: curY,
      size: 10,
      font: fontBold,
      color: colorPrimary,
    });

    curY -= 75;
    page.drawRectangle({
      x: margin,
      y: curY,
      width: contentWidth,
      height: 65,
      color: colorLightBg,
      borderColor: colorBorder,
      borderWidth: 1,
    });

    const f = statement.feedEfficiencyMetrics;
    const feedCols = [
      {
        l: "TOTAL FEED INTAKE",
        v: `${f.totalFeedConsumedKg.toLocaleString()} kg`,
      },
      {
        l: "AVG FEED COST",
        v: `${f.averageFeedCostPerKg} ${statement.farm.currency}/kg`,
      },
      {
        l: "DAIRY FEED/MILK",
        v: f.dairyFeedToMilkRatioKgPerLiter !== null
          ? `${f.dairyFeedToMilkRatioKgPerLiter} kg/L`
          : "N/A",
      },
      {
        l: "LIVESTOCK GROWTH FCR",
        v: f.growthOverallFcr !== null
          ? `${f.growthOverallFcr} FCR`
          : "N/A",
      },
      {
        l: "EFFICIENCY RATING",
        v: f.dairyRating || "AVERAGE",
        c:
          f.dairyRating === "EXCELLENT" || f.dairyRating === "GOOD"
            ? colorGreen
            : colorCharcoal,
      },
    ];

    for (let i = 0; i < feedCols.length; i++) {
      const col = feedCols[i]!;
      const fX = margin + i * dColW + 8;
      page.drawText(col.l, {
        x: fX,
        y: curY + 44,
        size: 7,
        font: fontBold,
        color: colorMuted,
      });
      page.drawText(col.v, {
        x: fX,
        y: curY + 20,
        size: 9,
        font: fontBold,
        color: col.c ?? colorCharcoal,
      });
    }

    // 7. Footer & Cryptographic Verification Hash
    const footerY = 55;
    page.drawLine({
      start: { x: margin, y: footerY + 15 },
      end: { x: pageWidth - margin, y: footerY + 15 },
      thickness: 1,
      color: colorBorder,
    });

    page.drawText(
      `Statement Integrity Hash: SHA256-${statement.statementMetadata.statementHash}`,
      {
        x: margin,
        y: footerY + 2,
        size: 7,
        font: fontRegular,
        color: colorMuted,
      }
    );

    page.drawText(
      `Generated on ${statement.statementMetadata.generatedAt} UTC • VetraLink Pro AgTech ERP • Page 1 of 1`,
      {
        x: margin,
        y: footerY - 12,
        size: 7,
        font: fontRegular,
        color: colorMuted,
      }
    );

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
