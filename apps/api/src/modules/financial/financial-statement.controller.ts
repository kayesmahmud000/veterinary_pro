import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import {
  FarmRole,
  MonthlyPerformanceStatementDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import { MonthlyStatementQueryDto } from "./dto";
import {
  FARM_PERFORMANCE_STATEMENT_SERVICE,
  IFarmPerformanceStatementService,
} from "./services/farm-performance-statement.service.interface";

@ApiTags("Financial - Monthly Statements")
@Controller("financial/statements")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class FinancialStatementController {
  constructor(
    @Inject(FARM_PERFORMANCE_STATEMENT_SERVICE)
    private readonly statementService: IFarmPerformanceStatementService
  ) {}

  @Get("monthly-pdf")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ApiOperation({
    summary: "Download Comprehensive Monthly Farm Performance PDF statement",
    description:
      "Generates and streams a professional A4 vector PDF statement consolidating executive P&L, category breakdowns, dairy unit economics (CPL), and feed efficiency / biological FCR benchmarks.",
  })
  @ApiProduces("application/pdf")
  @ApiOkResponse({
    description: "Binary PDF stream attachment",
    schema: {
      type: "string",
      format: "binary",
    },
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async downloadMonthlyPdf(
    @CurrentFarm("id") farmId: string,
    @Query() query: MonthlyStatementQueryDto,
    @Res() res: Response,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    const { pdfBuffer, filename } =
      await this.statementService.generateMonthlyPdf(farmId, query, traceId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  }

  @Get("monthly-summary")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage(
    "Monthly farm performance statement data retrieved successfully"
  )
  @ApiOperation({
    summary: "Retrieve structured Monthly Farm Performance statement JSON",
    description:
      "Returns consolidated statement data for in-app preview before triggering binary PDF download.",
  })
  @ApiOkResponse({
    description: "Structured monthly performance statement data",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getMonthlySummary(
    @CurrentFarm("id") farmId: string,
    @Query() query: MonthlyStatementQueryDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MonthlyPerformanceStatementDto> {
    return this.statementService.getMonthlyStatementData(
      farmId,
      query,
      traceId
    );
  }
}
