import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { FarmsModule } from "../farms";
import { AnimalsModule } from "../animals";
import { MilkLogRepository } from "./repositories/milk-log.repository";
import { MILK_LOG_REPOSITORY } from "./repositories/milk-log.repository.interface";
import { MilkYieldAnomalyRepository } from "./repositories/milk-yield-anomaly.repository";
import { MILK_YIELD_ANOMALY_REPOSITORY } from "./repositories/milk-yield-anomaly.repository.interface";
import { MilkLogService } from "./services/milk-log.service";
import { MILK_LOGS_SERVICE } from "./services/milk-log.service.interface";
import { MilkAnomalyQueueService } from "./services/milk-anomaly-queue.service";
import {
  IMilkAnomalyQueueService,
  MILK_ANOMALY_QUEUE,
  MILK_ANOMALY_QUEUE_SERVICE,
} from "./services/milk-anomaly-queue.service.interface";
import { MilkAnomalyService } from "./services/milk-anomaly.service";
import {
  IMilkAnomalyService,
  MILK_ANOMALY_SERVICE,
} from "./services/milk-anomaly.service.interface";
import { MilkExportService } from "./services/milk-export.service";
import {
  IMilkExportService,
  MILK_EXPORT_SERVICE,
} from "./services/milk-export.service.interface";
import { MilkAnomalyProcessor } from "./processors/milk-anomaly.processor";
import { MilkLogsController } from "./milk-logs.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    FarmsModule,
    AnimalsModule,
    BullModule.registerQueue({
      name: MILK_ANOMALY_QUEUE,
    }),
  ],
  controllers: [MilkLogsController],
  providers: [
    {
      provide: MILK_LOG_REPOSITORY,
      useClass: MilkLogRepository,
    },
    {
      provide: MILK_YIELD_ANOMALY_REPOSITORY,
      useClass: MilkYieldAnomalyRepository,
    },
    {
      provide: MILK_ANOMALY_QUEUE_SERVICE,
      useClass: MilkAnomalyQueueService,
    },
    {
      provide: MILK_LOGS_SERVICE,
      useClass: MilkLogService,
    },
    {
      provide: MILK_ANOMALY_SERVICE,
      useClass: MilkAnomalyService,
    },
    {
      provide: MILK_EXPORT_SERVICE,
      useClass: MilkExportService,
    },
    MilkLogRepository,
    MilkYieldAnomalyRepository,
    MilkAnomalyQueueService,
    MilkLogService,
    MilkAnomalyService,
    MilkExportService,
    MilkAnomalyProcessor,
  ],
  exports: [
    MILK_LOG_REPOSITORY,
    MILK_YIELD_ANOMALY_REPOSITORY,
    MILK_ANOMALY_QUEUE_SERVICE,
    MILK_LOGS_SERVICE,
    MILK_ANOMALY_SERVICE,
    MILK_EXPORT_SERVICE,
    MilkLogRepository,
    MilkYieldAnomalyRepository,
    MilkAnomalyQueueService,
    MilkLogService,
    MilkAnomalyService,
    MilkExportService,
  ],
})
export class MilkLogsModule {}
