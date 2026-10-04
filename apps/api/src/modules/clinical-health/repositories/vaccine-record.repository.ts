import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  VaccineRecordType as PrismaVaccineRecordType,
} from "@prisma/client";
import {
  AnimalStatus,
  PreventativeScheduleStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";
import {
  IVaccineRecordRepository,
  VaccineRecordQueryFilter,
  VaccineScheduleCounts,
} from "./vaccine-record.repository.interface";

type VaccineRecordWithRelations = Prisma.VaccineRecordGetPayload<{
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
    recorder: {
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
  recorder: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class VaccineRecordRepository implements IVaccineRecordRepository {
  private readonly logger = new Logger(VaccineRecordRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: VaccineRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity> {
    const client = tx ?? this.prisma;

    const created = await client.vaccineRecord.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        animalId: entity.animalId,
        administeredBy: entity.administeredById,
        recordType: entity.recordType as unknown as PrismaVaccineRecordType,
        vaccineName: entity.vaccineName,
        batchNumber: entity.batchNumber,
        doseAmount: new Prisma.Decimal(entity.doseAmount),
        doseUnit: entity.doseUnit,
        cost: new Prisma.Decimal(entity.cost),
        notes: entity.notes,
        administeredAt: entity.administeredAt,
        nextDueDate: entity.nextDueDate,
        syncVersion: entity.syncVersion,
      },
      include: defaultInclude,
    });

    return this.toDomain(created);
  }

  public async update(
    entity: VaccineRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity> {
    const client = tx ?? this.prisma;

    const updated = await client.vaccineRecord.update({
      where: { id: entity.id },
      data: {
        recordType: entity.recordType as unknown as PrismaVaccineRecordType,
        vaccineName: entity.vaccineName,
        batchNumber: entity.batchNumber,
        doseAmount: new Prisma.Decimal(entity.doseAmount),
        doseUnit: entity.doseUnit,
        cost: new Prisma.Decimal(entity.cost),
        notes: entity.notes,
        administeredAt: entity.administeredAt,
        nextDueDate: entity.nextDueDate,
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
  ): Promise<VaccineRecordEntity | null> {
    const client = tx ?? this.prisma;

    const record = await client.vaccineRecord.findFirst({
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
    filter: VaccineRecordQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: VaccineRecordEntity[]; total: number }> {
    const client = tx ?? this.prisma;

    const where: Prisma.VaccineRecordWhereInput = {
      farmId,
    };

    if (filter.animalId) {
      where.animalId = filter.animalId;
    }

    if (filter.recordType) {
      where.recordType = filter.recordType as unknown as PrismaVaccineRecordType;
    }

    const today = filter.asOfDate ? new Date(filter.asOfDate) : new Date();
    today.setHours(0, 0, 0, 0);

    if (filter.status) {
      const in14Days = new Date(today);
      in14Days.setDate(in14Days.getDate() + 14);
      in14Days.setHours(23, 59, 59, 999);

      switch (filter.status) {
        case PreventativeScheduleStatus.OVERDUE:
          where.nextDueDate = { lt: today };
          break;
        case PreventativeScheduleStatus.DUE_SOON:
          where.nextDueDate = { gte: today, lte: in14Days };
          break;
        case PreventativeScheduleStatus.UPCOMING:
          where.nextDueDate = { gt: in14Days };
          break;
        case PreventativeScheduleStatus.COMPLETED:
          where.nextDueDate = null;
          break;
      }
    }

    if (filter.startDate || filter.endDate) {
      where.administeredAt = {};
      if (filter.startDate) {
        where.administeredAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.administeredAt.lte = filter.endDate;
      }
    }

    if (filter.dueBefore || filter.dueAfter) {
      const existingFilter =
        where.nextDueDate && typeof where.nextDueDate === "object" && !(where.nextDueDate instanceof Date)
          ? (where.nextDueDate as Prisma.DateTimeNullableFilter)
          : {};

      where.nextDueDate = {
        ...existingFilter,
        ...(filter.dueAfter ? { gte: filter.dueAfter } : {}),
        ...(filter.dueBefore ? { lte: filter.dueBefore } : {}),
      };
    }

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const sortBy = filter.sortBy ?? "administeredAt";
    const sortOrder = filter.sortOrder ?? "desc";

    const [total, records] = await Promise.all([
      client.vaccineRecord.count({ where }),
      client.vaccineRecord.findMany({
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

  public async getScheduleCounts(
    farmId: string,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineScheduleCounts> {
    const client = tx ?? this.prisma;

    const today = asOfDate ? new Date(asOfDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    in30Days.setHours(23, 59, 59, 999);

    const [
      totalRecords,
      totalVaccinations,
      totalDewormings,
      dueNext7Days,
      dueNext30Days,
      overdueCount,
    ] = await Promise.all([
      client.vaccineRecord.count({ where: { farmId } }),
      client.vaccineRecord.count({
        where: {
          farmId,
          recordType: VaccineRecordType.VACCINATION as unknown as PrismaVaccineRecordType,
        },
      }),
      client.vaccineRecord.count({
        where: {
          farmId,
          recordType: VaccineRecordType.DEWORMING as unknown as PrismaVaccineRecordType,
        },
      }),
      client.vaccineRecord.count({
        where: {
          farmId,
          nextDueDate: { gte: today, lte: in7Days },
        },
      }),
      client.vaccineRecord.count({
        where: {
          farmId,
          nextDueDate: { gte: today, lte: in30Days },
        },
      }),
      client.vaccineRecord.count({
        where: {
          farmId,
          nextDueDate: { lt: today },
        },
      }),
    ]);

    return {
      totalRecords,
      totalVaccinations,
      totalDewormings,
      dueNext7Days,
      dueNext30Days,
      overdueCount,
    };
  }

  public async findUpcoming(
    farmId: string,
    daysAhead = 30,
    limit = 10,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity[]> {
    const client = tx ?? this.prisma;

    const today = asOfDate ? new Date(asOfDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + daysAhead);
    horizon.setHours(23, 59, 59, 999);

    const records = await client.vaccineRecord.findMany({
      where: {
        farmId,
        nextDueDate: { gte: today, lte: horizon },
      },
      take: limit,
      orderBy: { nextDueDate: "asc" },
      include: defaultInclude,
    });

    return records.map((r) => this.toDomain(r));
  }

  public async findRecordsForReminderScan(
    farmId?: string,
    daysAhead = 7,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity[]> {
    const client = tx ?? this.prisma;

    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const horizon = new Date(baseDate);
    horizon.setDate(horizon.getDate() + daysAhead);
    horizon.setHours(23, 59, 59, 999);

    const where: Prisma.VaccineRecordWhereInput = {
      nextDueDate: {
        not: null,
        lte: horizon,
      },
      animal: {
        status: {
          notIn: [AnimalStatus.SOLD, AnimalStatus.DECEASED, AnimalStatus.CULLED],
        },
      },
      ...(farmId ? { farmId } : {}),
    };

    const records = await client.vaccineRecord.findMany({
      where,
      orderBy: { nextDueDate: "asc" },
      include: defaultInclude,
    });

    return records.map((r) => this.toDomain(r));
  }

  public async delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.vaccineRecord.deleteMany({
      where: { id, farmId },
    });
  }

  private toDomain(record: VaccineRecordWithRelations): VaccineRecordEntity {
    return new VaccineRecordEntity({
      id: record.id,
      farmId: record.farmId,
      animalId: record.animalId,
      administeredById: record.administeredBy,
      recordType: record.recordType as unknown as VaccineRecordType,
      vaccineName: record.vaccineName,
      batchNumber: record.batchNumber,
      doseAmount: Number(record.doseAmount),
      doseUnit: record.doseUnit,
      cost: Number(record.cost),
      notes: record.notes,
      administeredAt: record.administeredAt,
      nextDueDate: record.nextDueDate,
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
      administeredBy: record.recorder
        ? {
            id: record.recorder.id,
            name: record.recorder.name,
            email: record.recorder.email,
            role: record.recorder.role,
          }
        : null,
    });
  }
}
