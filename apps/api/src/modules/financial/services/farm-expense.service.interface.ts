import {
  ExpenseResponseDto,
  ExpenseSummaryResponseDto,
  PaginatedExpensesDto,
} from "@vetralink/shared-types";
import {
  ExpenseQueryDto,
  ExpenseSummaryQueryDto,
  RecordExpenseDto,
  UpdateExpenseDto,
} from "../dto";

export interface IFarmExpenseService {
  recordExpense(
    farmId: string,
    actorUserId: string,
    dto: RecordExpenseDto,
    traceId?: string
  ): Promise<ExpenseResponseDto>;

  updateExpense(
    farmId: string,
    id: string,
    actorUserId: string,
    dto: UpdateExpenseDto,
    traceId?: string
  ): Promise<ExpenseResponseDto>;

  getExpenseById(farmId: string, id: string): Promise<ExpenseResponseDto>;

  getExpenses(
    farmId: string,
    query: ExpenseQueryDto
  ): Promise<PaginatedExpensesDto>;

  getExpenseSummary(
    farmId: string,
    query: ExpenseSummaryQueryDto
  ): Promise<ExpenseSummaryResponseDto>;

  deleteExpense(
    farmId: string,
    id: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;
}

export const FARM_EXPENSE_SERVICE = "FARM_EXPENSE_SERVICE";
