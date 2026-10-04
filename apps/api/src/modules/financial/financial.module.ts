import { Module } from "@nestjs/common";
import { AnimalsModule } from "../animals/animals.module";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth";
import { FarmsModule } from "../farms";
import { PrismaModule } from "../prisma/prisma.module";
import { FinancialExpenseController } from "./financial-expense.controller";
import { FinancialFeedAnalyticsController } from "./financial-feed-analytics.controller";
import { FinancialProfitLossController } from "./financial-profit-loss.controller";
import { FinancialRevenueController } from "./financial-revenue.controller";
import { FinancialStatementController } from "./financial-statement.controller";
import { FarmPerformancePdfGenerator } from "./pdf/farm-performance-pdf.generator";
import { FarmExpenseRepository } from "./repositories/farm-expense.repository";
import { FARM_EXPENSE_REPOSITORY } from "./repositories/farm-expense.repository.interface";
import { FarmFeedAnalyticsRepository } from "./repositories/farm-feed-analytics.repository";
import { FARM_FEED_ANALYTICS_REPOSITORY } from "./repositories/farm-feed-analytics.repository.interface";
import { FarmProfitLossRepository } from "./repositories/farm-profit-loss.repository";
import { FARM_PROFIT_LOSS_REPOSITORY } from "./repositories/farm-profit-loss.repository.interface";
import { FarmRevenueRepository } from "./repositories/farm-revenue.repository";
import { FARM_REVENUE_REPOSITORY } from "./repositories/farm-revenue.repository.interface";
import { FarmExpenseService } from "./services/farm-expense.service";
import { FARM_EXPENSE_SERVICE } from "./services/farm-expense.service.interface";
import { FarmFeedAnalyticsService } from "./services/farm-feed-analytics.service";
import { FARM_FEED_ANALYTICS_SERVICE } from "./services/farm-feed-analytics.service.interface";
import { FarmPerformanceStatementService } from "./services/farm-performance-statement.service";
import { FARM_PERFORMANCE_STATEMENT_SERVICE } from "./services/farm-performance-statement.service.interface";
import { FarmProfitLossService } from "./services/farm-profit-loss.service";
import { FARM_PROFIT_LOSS_SERVICE } from "./services/farm-profit-loss.service.interface";
import { FarmRevenueService } from "./services/farm-revenue.service";
import { FARM_REVENUE_SERVICE } from "./services/farm-revenue.service.interface";

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, FarmsModule, AnimalsModule],
  controllers: [
    FinancialExpenseController,
    FinancialRevenueController,
    FinancialProfitLossController,
    FinancialFeedAnalyticsController,
    FinancialStatementController,
  ],
  providers: [
    {
      provide: FARM_EXPENSE_REPOSITORY,
      useClass: FarmExpenseRepository,
    },
    {
      provide: FARM_EXPENSE_SERVICE,
      useClass: FarmExpenseService,
    },
    {
      provide: FARM_REVENUE_REPOSITORY,
      useClass: FarmRevenueRepository,
    },
    {
      provide: FARM_REVENUE_SERVICE,
      useClass: FarmRevenueService,
    },
    {
      provide: FARM_PROFIT_LOSS_REPOSITORY,
      useClass: FarmProfitLossRepository,
    },
    {
      provide: FARM_PROFIT_LOSS_SERVICE,
      useClass: FarmProfitLossService,
    },
    {
      provide: FARM_FEED_ANALYTICS_REPOSITORY,
      useClass: FarmFeedAnalyticsRepository,
    },
    {
      provide: FARM_FEED_ANALYTICS_SERVICE,
      useClass: FarmFeedAnalyticsService,
    },
    {
      provide: FARM_PERFORMANCE_STATEMENT_SERVICE,
      useClass: FarmPerformanceStatementService,
    },
    FarmPerformancePdfGenerator,
    FarmExpenseRepository,
    FarmExpenseService,
    FarmRevenueRepository,
    FarmRevenueService,
    FarmProfitLossRepository,
    FarmProfitLossService,
    FarmFeedAnalyticsRepository,
    FarmFeedAnalyticsService,
    FarmPerformanceStatementService,
  ],
  exports: [
    FARM_EXPENSE_REPOSITORY,
    FARM_EXPENSE_SERVICE,
    FarmExpenseRepository,
    FarmExpenseService,
    FARM_REVENUE_REPOSITORY,
    FARM_REVENUE_SERVICE,
    FarmRevenueRepository,
    FarmRevenueService,
    FARM_PROFIT_LOSS_REPOSITORY,
    FARM_PROFIT_LOSS_SERVICE,
    FarmProfitLossRepository,
    FarmProfitLossService,
    FARM_FEED_ANALYTICS_REPOSITORY,
    FARM_FEED_ANALYTICS_SERVICE,
    FarmFeedAnalyticsRepository,
    FarmFeedAnalyticsService,
    FARM_PERFORMANCE_STATEMENT_SERVICE,
    FarmPerformanceStatementService,
    FarmPerformancePdfGenerator,
  ],
})
export class FinancialModule {}
