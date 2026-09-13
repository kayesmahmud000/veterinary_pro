import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  ExpenseResponseDto,
  ExpenseSummaryResponseDto,
  FarmRole,
  JwtPayload,
  PaginatedExpensesDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  CurrentUser,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import {
  ExpenseQueryDto,
  ExpenseSummaryQueryDto,
  RecordExpenseDto,
  UpdateExpenseDto,
} from "./dto";
import {
  FARM_EXPENSE_SERVICE,
  IFarmExpenseService,
} from "./services/farm-expense.service.interface";

@ApiTags("Financial - Expense Tracking")
@Controller("financial/expenses")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class FinancialExpenseController {
  constructor(
    @Inject(FARM_EXPENSE_SERVICE)
    private readonly expenseService: IFarmExpenseService
  ) {}

  @Post()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Farm expense recorded successfully")
  @ApiOperation({
    summary: "Record a new operational farm expense",
    description:
      "Logs an operational expense under FEED, MEDICINE, LABOR, EQUIPMENT, UTILITY, or OTHER with optional animal attribution.",
  })
  @ApiCreatedResponse({ description: "Farm expense recorded successfully" })
  @ApiNotFoundResponse({ description: "Animal not found" })
  @ApiUnprocessableEntityResponse({
    description: "Animal is deceased/sold or invalid expense payload",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async recordExpense(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordExpenseDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.recordExpense(farmId, user.sub, dto, traceId);
  }

  @Get("summary")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Expense summary analytics retrieved successfully")
  @ApiOperation({
    summary: "Retrieve aggregated expense breakdown and trend analytics",
    description:
      "Aggregates total expenses, breakdown per category (monetary sum, count, percentage), top cost category, and daily timeline distribution.",
  })
  @ApiOkResponse({
    description: "Aggregated expense analytics retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getExpenseSummary(
    @CurrentFarm("id") farmId: string,
    @Query() query: ExpenseSummaryQueryDto
  ): Promise<ExpenseSummaryResponseDto> {
    return this.expenseService.getExpenseSummary(farmId, query);
  }

  @Get()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Farm expenses retrieved successfully")
  @ApiOperation({
    summary: "Query and filter operational farm expenses with pagination",
  })
  @ApiOkResponse({ description: "Paginated farm expenses retrieved" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async listExpenses(
    @CurrentFarm("id") farmId: string,
    @Query() query: ExpenseQueryDto
  ): Promise<PaginatedExpensesDto> {
    return this.expenseService.getExpenses(farmId, query);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Farm expense retrieved successfully")
  @ApiOperation({
    summary: "Get detailed information for a single farm expense",
  })
  @ApiOkResponse({ description: "Farm expense details retrieved" })
  @ApiNotFoundResponse({ description: "Farm expense not found" })
  public async getExpenseById(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.getExpenseById(farmId, id);
  }

  @Patch(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Farm expense updated successfully")
  @ApiOperation({
    summary: "Update an existing farm expense record",
  })
  @ApiOkResponse({ description: "Farm expense updated successfully" })
  @ApiConflictResponse({
    description: "Optimistic concurrency version conflict",
  })
  @ApiNotFoundResponse({ description: "Farm expense or animal not found" })
  public async updateExpense(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.updateExpense(
      farmId,
      id,
      user.sub,
      dto,
      traceId
    );
  }

  @Delete(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage("Farm expense deleted successfully")
  @ApiOperation({
    summary: "Soft-delete an erroneous or cancelled farm expense",
  })
  @ApiNoContentResponse({ description: "Farm expense deleted successfully" })
  @ApiNotFoundResponse({ description: "Farm expense not found" })
  public async deleteExpense(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    return this.expenseService.deleteExpense(farmId, id, user.sub, traceId);
  }
}
