import { MonthlyPerformanceStatementDto } from "@vetralink/shared-types";
import { MonthlyStatementQueryDto } from "../dto";

export interface MonthlyPdfResult {
  pdfBuffer: Buffer;
  filename: string;
}

export interface IFarmPerformanceStatementService {
  generateMonthlyPdf(
    farmId: string,
    query: MonthlyStatementQueryDto,
    traceId?: string
  ): Promise<MonthlyPdfResult>;

  getMonthlyStatementData(
    farmId: string,
    query: MonthlyStatementQueryDto,
    traceId?: string
  ): Promise<MonthlyPerformanceStatementDto>;
}

export const FARM_PERFORMANCE_STATEMENT_SERVICE = Symbol(
  "FARM_PERFORMANCE_STATEMENT_SERVICE"
);
