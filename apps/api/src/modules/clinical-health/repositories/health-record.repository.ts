import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  HealthEventType as PrismaHealthEventType,
  SeverityLevel as PrismaSeverityLevel,
} from "@prisma/client";
import {
  AnimalStatus,
  HealthEventType,
  SeverityLevel,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthRecordEntity } from "../entities/health-record.entity";
import {
  IHealthRecordRepository,
  HealthRecordQueryFilter,
} from "./health-record.repository.interface";

type HealthRecordWithRelations = Prisma.HealthRecordGetPayload<{
  include: {
    animal: {
      select: {
        id: true;
        tagNumber: true;
        name: true;
        species: true;
        breed: true;
        gender: true;
      };
    };
    recordedBy: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
    attendingVet: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
  };
}>;

const defaultInclude = {
  animal: {
    select: {
      id: true,
      tagNumber: true,
      name: true,
      species: true,
      breed: true,
      gender: true,
    },
  },
  recordedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  attendingVet: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class HealthRecordRepository implements IHealthRecordRepository {
  private readonly logger = new Logger(HealthRecordRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: HealthRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordEntity> {
    const client = tx ?? this.prisma;

    const created = await client.healthRecord.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        animalId: entity.animalId,
        recordedById: entity.recordedById,
        attendingVetId: entity.attendingVetId,
        eventType: entity.eventType as unknown as PrismaHealthEventType,
        severity: entity.severity as unknown as PrismaSeverityLevel,
        symptoms: entity.symptoms,
        diagnosis: entity.diagnosis,
        treatment: entity.treatment,
        cost: new Prisma.Decimal(entity.cost),
        resolvedAt: entity.resolvedAt,
        escalationLevel: entity.escalationLevel,
        lastEscalatedAt: entity.lastEscalatedAt,
        syncVersion: entity.syncVersion,
      },
      include: defaultInclude,
    });

    return this.toDomain(created);
  }

  public async update(
    entity: HealthRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordEntity> {
    const client = tx ?? this.prisma;

    const updated = await client.healthRecord.update({
      where: { id: entity.id },
      data: {
        attendingVetId: entity.attendingVetId,
        eventType: entity.eventType as unknown as PrismaHealthEventType,
        severity: entity.severity as unknown as PrismaSeverityLevel,
        symptoms: entity.symptoms,
        diagnosis: entity.diagnosis,
        treatment: entity.treatment,
        cost: new Prisma.Decimal(entity.cost),
        resolvedAt: entity.resolvedAt,
        escalationLevel: entity.escalationLevel,
        lastEscalatedAt: entity.lastEscalatedAt,
        syncVersion: entity.syncVersion,
      },
      include: defaultInclude,
    });

    return this.toDomain(updated);
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordEntity | null> {
    const client = tx ?? this.prisma;

    const record = await client.healthRecord.findFirst({
      where: { id, farmId },
      include: defaultInclude,
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  public async findMany(
    farmId: string,
    filter: HealthRecordQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: HealthRecordEntity[]; total: number }> {
    const client = tx ?? this.prisma;

    const where: Prisma.HealthRecordWhereInput = {
      farmId,
    };

    if (filter.animalId) {
      where.animalId = filter.animalId;
    }

    if (filter.eventType) {
      where.eventType = filter.eventType as unknown as PrismaHealthEventType;
    }

    if (filter.severity) {
      where.severity = filter.severity as unknown as PrismaSeverityLevel;
    }

    if (filter.isResolved !== undefined) {
      where.resolvedAt = filter.isResolved ? { not: null } : null;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const sortBy = filter.sortBy ?? "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";

    const [total, records] = await Promise.all([
      client.healthRecord.count({ where }),
      client.healthRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: defaultInclude,
      }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  public async delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.healthRecord.deleteMany({
      where: { id, farmId },
    });
  }

  public async findUnresolvedCriticalCases(
    farmId?: string,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordEntity[]> {
    const client = tx ?? this.prisma;

    const where: Prisma.HealthRecordWhereInput = {
      resolvedAt: null,
      severity: {
        in: [PrismaSeverityLevel.CRITICAL, PrismaSeverityLevel.HIGH],
      },
      animal: {
        status: {
          notIn: [
            AnimalStatus.SOLD,
            AnimalStatus.DECEASED,
            AnimalStatus.CULLED,
          ],
        },
        deletedAt: null,
      },
      ...(farmId ? { farmId } : {}),
      ...(asOfDate ? { createdAt: { lte: asOfDate } } : {}),
    };

    const records = await client.healthRecord.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: defaultInclude,
    });

    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: HealthRecordWithRelations): HealthRecordEntity {
    return new HealthRecordEntity({
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      recordedById: record.recordedById,
      attendingVetId: record.attendingVetId,
      eventType: record.eventType as unknown as HealthEventType,
      severity: record.severity as unknown as SeverityLevel,
      symptoms: record.symptoms,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      cost: Number(record.cost),
      resolvedAt: record.resolvedAt,
      escalationLevel: record.escalationLevel,
      lastEscalatedAt: record.lastEscalatedAt,
      syncVersion: record.syncVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      animal: record.animal
        ? {
            id: record.animal.id,
            tagNumber: record.animal.tagNumber,
            name: record.animal.name,
            species: record.animal.species,
            breed: record.animal.breed,
            gender: record.animal.gender,
          }
        : null,
      recordedBy: record.recordedBy
        ? {
            id: record.recordedBy.id,
            name: record.recordedBy.name,
            email: record.recordedBy.email,
            role: record.recordedBy.role,
          }
        : null,
      attendingVet: record.attendingVet
        ? {
            id: record.attendingVet.id,
            name: record.attendingVet.name,
            email: record.attendingVet.email,
            role: record.attendingVet.role,
          }
        : null,
    });
  }
}
