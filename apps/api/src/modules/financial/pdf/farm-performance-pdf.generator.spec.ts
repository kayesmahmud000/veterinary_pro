import { PDFDocument } from "pdf-lib";
import {
  MonthlyPerformanceStatementDto,
  TransactionCategory,
} from "@vetralink/shared-types";
import { FarmPerformancePdfGenerator } from "./farm-performance-pdf.generator";

describe("FarmPerformancePdfGenerator", () => {
  let generator: FarmPerformancePdfGenerator;

  const mockStatement: MonthlyPerformanceStatementDto = {
    farm: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Apex Green Pastures",
      slug: "apex-green",
      farmType: "DAIRY",
      country: "United States",
      currency: "USD",
    },
    period: {
      year: 2026,
      month: 9,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    },
    financialSummary: {
      totalRevenue: 15000,
      totalExpense: 8500,
      netProfit: 6500,
      profitMarginPercentage: 43.33,
      operatingExpenseRatio: 56.67,
      isProfitable: true,
    },
    revenueBreakdown: [
      {
        category: TransactionCategory.MILK_SALES,
        amount: 12000,
        transactionCount: 25,
        percentage: 80.0,
      },
      {
        category: TransactionCategory.MANURE,
        amount: 3000,
        transactionCount: 5,
        percentage: 20.0,
      },
    ],
    expenseBreakdown: [
      {
        category: TransactionCategory.FEED,
        amount: 5500,
        transactionCount: 12,
        percentage: 64.71,
      },
      {
        category: TransactionCategory.LABOR,
        amount: 3000,
        transactionCount: 4,
        percentage: 35.29,
      },
    ],
    dairyMetrics: {
      totalMilkYieldLiters: 20000,
      averageDailyYieldLiters: 666.667,
      feedCostPerLiter: 0.28,
      operatingCostPerLiter: 0.43,
      revenuePerLiter: 0.6,
      netMarginPerLiter: 0.17,
      breakEvenMilkPrice: 0.43,
      isProfitablePerLiter: true,
    },
    feedEfficiencyMetrics: {
      totalFeedConsumedKg: 14000,
      totalFeedExpense: 5500,
      averageFeedCostPerKg: 0.39,
      dairyFeedToMilkRatioKgPerLiter: 0.7,
      growthOverallFcr: 5.5,
      growthRating: "GOOD",
      dairyRating: "EXCELLENT",
    },
    statementMetadata: {
      generatedAt: "2026-09-30 23:59:59",
      statementHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  };

  beforeEach(() => {
    generator = new FarmPerformancePdfGenerator();
  });

  it("should generate a valid PDF buffer from monthly statement data", async () => {
    const pdfBuffer = await generator.generatePdf(mockStatement);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes: "%PDF-"
    const header = pdfBuffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");

    // Load back via pdf-lib to ensure structural integrity
    const loadedDoc = await PDFDocument.load(pdfBuffer);
    expect(loadedDoc.getPageCount()).toBe(1);
  });

  it("should generate a valid PDF when breakdown tables are empty", async () => {
    const emptyStatement: MonthlyPerformanceStatementDto = {
      ...mockStatement,
      revenueBreakdown: [],
      expenseBreakdown: [],
      feedEfficiencyMetrics: {
        ...mockStatement.feedEfficiencyMetrics,
        dairyFeedToMilkRatioKgPerLiter: null,
        growthOverallFcr: null,
      },
    };

    const pdfBuffer = await generator.generatePdf(emptyStatement);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const loadedDoc = await PDFDocument.load(pdfBuffer);
    expect(loadedDoc.getPageCount()).toBe(1);
  });
});
