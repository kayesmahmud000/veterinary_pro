import { Prisma } from "@prisma/client";
import { AuditLogEntity } from "../entities/audit-log.entity";
import { CreateAuditLogDto } from "../dto/create-audit-log.dto";
import { AuditQueryDto } from "../dto/audit-query.dto";

export interface IAuditLogRepository {
  record(
    dto: CreateAuditLogDto,
    tx?: Prisma.TransactionClient
  ): Promise<AuditLogEntity>;

  findByEntity(
    entityType: string,
    entityId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ items: AuditLogEntity[]; total: number }>;

  findByTraceId(traceId: string): Promise<AuditLogEntity[]>;

  query(
    queryDto: AuditQueryDto
  ): Promise<{ items: AuditLogEntity[]; total: number }>;
}

export const AUDIT_LOG_REPOSITORY = "AUDIT_LOG_REPOSITORY";
