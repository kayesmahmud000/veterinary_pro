import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { FarmsModule } from "../farms";
import { PrismaModule } from "../prisma";
import { SyncController } from "./controllers/sync.controller";
import { SYNC_REPOSITORY } from "./repositories/sync.repository.interface";
import { SyncRepository } from "./repositories/sync.repository";
import { SYNC_SERVICE } from "./services/sync.service.interface";
import { SyncService } from "./services/sync.service";

@Module({
  imports: [PrismaModule, AuditModule, FarmsModule],
  controllers: [SyncController],
  providers: [
    {
      provide: SYNC_REPOSITORY,
      useClass: SyncRepository,
    },
    {
      provide: SYNC_SERVICE,
      useClass: SyncService,
    },
  ],
  exports: [SYNC_SERVICE, SYNC_REPOSITORY],
})
export class SyncModule {}
