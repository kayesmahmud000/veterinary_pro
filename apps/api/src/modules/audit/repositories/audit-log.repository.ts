import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditLogEntity } from "../entities/audit-log.entity";
import { CreateAuditLogDto } from "../dto/create-audit-log.dto";
import { AuditQueryDto } from "../dto/audit-query.dto";
import { IAuditLogRepository } from "./audit-log.repository.interface";

@Injectable()
export class AuditLogRepository implements IAuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    dto: CreateAuditLogDto,
    tx?: Prisma.TransactionClient
  ): Promise<AuditLogEntity> {
    const client = tx ?? this.prisma;

    const sanitizedOld = this.sanitizeJson(dto.oldValues);
    const sanitizedNew = this.sanitizeJson(dto.newValues);

    const created = await client.auditLog.create({
      data: {
        userId: dto.userId ?? null,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        oldValues: (sanitizedOld as Prisma.InputJsonValue) ?? Prisma.DbNull,
        newValues: (sanitizedNew as Prisma.InputJsonValue) ?? Prisma.DbNull,
        traceId: dto.traceId,
        ipAddress: dto.ipAddress ?? null,
      },
    });

    this.logger.debug(
      `Audit record created [${dto.action} on ${dto.entityType}:${dto.entityId}] (Trace: ${dto.traceId})`
    );

    return this.toEntity(created);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    page = 1,
    pageSize = 20
  ): Promise<{ items: AuditLogEntity[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where: { entityType, entityId } }),
    ]);

    return {
      items: records.map((r) => this.toEntity(r)),
      total,
    };
  }

  async findByTraceId(traceId: string): Promise<AuditLogEntity[]> {
    const records = await this.prisma.auditLog.findMany({
      where: { traceId },
      orderBy: { createdAt: "asc" },
    });

    return records.map((r) => this.toEntity(r));
  }

  async query(
    queryDto: AuditQueryDto
  ): Promise<{ items: AuditLogEntity[]; total: number }> {
    const page = queryDto.page ?? 1;
    const pageSize = queryDto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    if (queryDto.entityType) where.entityType = queryDto.entityType;
    if (queryDto.entityId) where.entityId = queryDto.entityId;
    if (queryDto.userId) where.userId = queryDto.userId;
    if (queryDto.traceId) where.traceId = queryDto.traceId;

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: records.map((r) => this.toEntity(r)),
      total,
    };
  }

  private sanitizeJson(
    obj?: Record<string, unknown> | null
  ): Record<string, unknown> | null {
    if (!obj || typeof obj !== "object") return null;

    const sensitiveSubstrings = [
      "password",
      "password_hash",
      "passwordhash",
      "token",
      "refreshtoken",
      "secret",
      "key",
      "apikey",
      "privatekey",
      "secretkey",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      if (sensitiveSubstrings.some((sub) => lowerKey.includes(sub))) {
        sanitized[k] = "[REDACTED]";
      } else if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        !(v instanceof Date)
      ) {
        sanitized[k] = this.sanitizeJson(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  private toEntity(
    row: Prisma.AuditLogGetPayload<Record<string, never>>
  ): AuditLogEntity {
    return new AuditLogEntity({
      id: row.id,
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      oldValues: (row.oldValues as Record<string, unknown>) ?? null,
      newValues: (row.newValues as Record<string, unknown>) ?? null,
      traceId: row.traceId,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
    });
  }
}
