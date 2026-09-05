import { Global, Module } from "@nestjs/common";
import { AuditLogRepository } from "./repositories/audit-log.repository";
import { AUDIT_LOG_REPOSITORY } from "./repositories/audit-log.repository.interface";

@Global()
@Module({
  providers: [
    AuditLogRepository,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useExisting: AuditLogRepository,
    },
  ],
  exports: [AuditLogRepository, AUDIT_LOG_REPOSITORY],
})
export class AuditModule {}
