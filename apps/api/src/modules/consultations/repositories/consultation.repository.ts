import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  ConsultationType,
  QueryFarmerConsultationsDto,
  QueryTriageQueueDto,
  TriageCaseDetailDto,
  TriageMetricsDto,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import { IConsultationRepository } from "./consultation.repository.interface";

const CONSULTATION_INCLUDE = {
  farmer: { select: { id: true, name: true, email: true } },
  vet: { select: { id: true, name: true, email: true } },
  animal: {
    select: {
      id: true,
      name: true,
      tagNumber: true,
      species: true,
    },
  },
  farm: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ConsultationRepository implements IConsultationRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findById(
    id: string,
    farmId?: string,
  ): Promise<ConsultationEntity | null> {
    const where: Prisma.ConsultationWhereInput = { id };
    if (farmId) {
      where.farmId = farmId;
    }

    const record = await this.prisma.consultation.findFirst({
      where,
      include: CONSULTATION_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return ConsultationEntity.fromPersistence(record);
  }

  public async create(
    entity: ConsultationEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultation.create({
      data: {
        id: entity.id,
        farmerId: entity.farmerId,
        vetId: entity.vetId,
        farmId: entity.farmId,
        animalId: entity.animalId,
        chiefComplaint: entity.chiefComplaint,
        mediaUrls: entity.mediaUrls,
        type: entity.type,
        status: entity.status,
        roomSessionId: entity.roomSessionId,
        feeCents: entity.feeCents,
        scheduledAt: entity.scheduledAt,
        assignedAt: entity.assignedAt,
        paymentStatus: entity.paymentStatus,
        paymentIntentId: entity.paymentIntentId,
        paymentHeldAt: entity.paymentHeldAt,
        paymentCapturedAt: entity.paymentCapturedAt,
        paymentReleasedAt: entity.paymentReleasedAt,
        currency: entity.currency,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: CONSULTATION_INCLUDE,
    });

    return ConsultationEntity.fromPersistence(record);
  }

  public async save(
    entity: ConsultationEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultation.update({
      where: { id: entity.id },
      data: {
        vetId: entity.vetId,
        animalId: entity.animalId,
        chiefComplaint: entity.chiefComplaint,
        mediaUrls: entity.mediaUrls,
        type: entity.type,
        status: entity.status,
        roomSessionId: entity.roomSessionId,
        feeCents: entity.feeCents,
        scheduledAt: entity.scheduledAt,
        assignedAt: entity.assignedAt,
        paymentStatus: entity.paymentStatus,
        paymentIntentId: entity.paymentIntentId,
        paymentHeldAt: entity.paymentHeldAt,
        paymentCapturedAt: entity.paymentCapturedAt,
        paymentReleasedAt: entity.paymentReleasedAt,
        currency: entity.currency,
        updatedAt: entity.updatedAt,
      },
      include: CONSULTATION_INCLUDE,
    });

    return ConsultationEntity.fromPersistence(record);
  }

  public async findByFarm(
    farmId: string,
    query?: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = { farmId };
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.animalId) {
      where.animalId = query.animalId;
    }
    if (query?.type) {
      where.type = query.type;
    }

    const [records, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        include: CONSULTATION_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      items: records.map((r) => ConsultationEntity.fromPersistence(r)),
      total,
    };
  }

  public async findByFarmer(
    farmerId: string,
    query?: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = { farmerId };
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.animalId) {
      where.animalId = query.animalId;
    }
    if (query?.type) {
      where.type = query.type;
    }

    const [records, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        include: CONSULTATION_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      items: records.map((r) => ConsultationEntity.fromPersistence(r)),
      total,
    };
  }

  public async findTriageQueue(
    query?: QueryTriageQueueDto,
  ): Promise<{ items: ConsultationEntity[]; total: number }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = {};

    if (query?.status) {
      if (query.status !== "ALL") {
        where.status = query.status;
      }
    } else {
      where.status = ConsultationStatus.SUBMITTED;
    }

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.species) {
      where.animal = { species: query.species };
    }

    if (query?.farmId) {
      where.farmId = query.farmId;
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query?.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { chiefComplaint: { contains: term, mode: "insensitive" } },
        { farmer: { name: { contains: term, mode: "insensitive" } } },
        { farmer: { email: { contains: term, mode: "insensitive" } } },
        { animal: { tagNumber: { contains: term, mode: "insensitive" } } },
        { animal: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    const sortBy = query?.sortBy ?? "createdAt";
    const sortOrder = query?.sortOrder ?? "asc";
    const orderBy: Prisma.ConsultationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [records, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        include: CONSULTATION_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      items: records.map((r) => ConsultationEntity.fromPersistence(r)),
      total,
    };
  }

  public async getTriageMetrics(now = new Date()): Promise<TriageMetricsDto> {
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const [
      pendingCount,
      assignedCount,
      inProgressCount,
      completedTodayCount,
      cancelledTodayCount,
      asyncTickets,
      liveVideos,
      pendingConsultations,
    ] = await Promise.all([
      this.prisma.consultation.count({
        where: { status: ConsultationStatus.SUBMITTED },
      }),
      this.prisma.consultation.count({
        where: { status: ConsultationStatus.ASSIGNED },
      }),
      this.prisma.consultation.count({
        where: { status: ConsultationStatus.IN_PROGRESS },
      }),
      this.prisma.consultation.count({
        where: {
          status: ConsultationStatus.COMPLETED,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.consultation.count({
        where: {
          status: ConsultationStatus.CANCELLED,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.consultation.count({
        where: {
          type: ConsultationType.ASYNC_TICKET,
          status: {
            in: [
              ConsultationStatus.SUBMITTED,
              ConsultationStatus.ASSIGNED,
              ConsultationStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      this.prisma.consultation.count({
        where: {
          type: ConsultationType.LIVE_VIDEO,
          status: {
            in: [
              ConsultationStatus.SUBMITTED,
              ConsultationStatus.ASSIGNED,
              ConsultationStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      this.prisma.consultation.findMany({
        where: { status: ConsultationStatus.SUBMITTED },
        select: {
          createdAt: true,
          animal: {
            select: { species: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const speciesBreakdown: Record<string, number> = {};
    let totalWaitMinutes = 0;
    let oldestPendingWaitMinutes = 0;

    if (pendingConsultations.length > 0) {
      for (const item of pendingConsultations) {
        if (item.animal?.species) {
          speciesBreakdown[item.animal.species] =
            (speciesBreakdown[item.animal.species] ?? 0) + 1;
        } else {
          speciesBreakdown["UNSPECIFIED"] =
            (speciesBreakdown["UNSPECIFIED"] ?? 0) + 1;
        }
        const waitMin = Math.max(
          0,
          Math.round((now.getTime() - item.createdAt.getTime()) / 60000),
        );
        totalWaitMinutes += waitMin;
      }
      const oldest = pendingConsultations[0];
      if (oldest) {
        oldestPendingWaitMinutes = Math.max(
          0,
          Math.round((now.getTime() - oldest.createdAt.getTime()) / 60000),
        );
      }
    }

    const avgWaitTimeMinutes =
      pendingConsultations.length > 0
        ? Math.round(totalWaitMinutes / pendingConsultations.length)
        : 0;

    return {
      pendingCount,
      assignedCount,
      inProgressCount,
      completedTodayCount,
      cancelledTodayCount,
      typeBreakdown: {
        asyncTickets,
        liveVideos,
      },
      speciesBreakdown,
      avgWaitTimeMinutes,
      oldestPendingWaitMinutes,
    };
  }

  public async findTriageCaseDetail(
    id: string,
  ): Promise<TriageCaseDetailDto | null> {
    const record = await this.prisma.consultation.findUnique({
      where: { id },
      include: {
        farmer: { select: { id: true, name: true, email: true, phone: true } },
        vet: { select: { id: true, name: true, email: true } },
        farm: { select: { id: true, name: true, farmType: true } },
        animal: {
          select: {
            id: true,
            name: true,
            tagNumber: true,
            rfidNumber: true,
            species: true,
            breed: true,
            gender: true,
            dateOfBirth: true,
            weightKg: true,
            status: true,
            healthRecords: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                eventType: true,
                severity: true,
                symptoms: true,
                diagnosis: true,
                treatment: true,
                createdAt: true,
                resolvedAt: true,
              },
            },
            vaccineRecords: {
              orderBy: { administeredAt: "desc" },
              take: 5,
              select: {
                id: true,
                recordType: true,
                vaccineName: true,
                administeredAt: true,
                doseAmount: true,
                doseUnit: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    const now = new Date();
    const waitTimeMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(record.createdAt).getTime()) / 60000),
    );

    const animalDetails = record.animal
      ? {
          id: record.animal.id,
          name: record.animal.name,
          tagNumber: record.animal.tagNumber,
          rfidNumber: record.animal.rfidNumber,
          species: record.animal.species,
          breed: record.animal.breed,
          gender: record.animal.gender,
          dateOfBirth: record.animal.dateOfBirth
            ? record.animal.dateOfBirth.toISOString().split("T")[0]!
            : null,
          weightKg: record.animal.weightKg
            ? Number(record.animal.weightKg)
            : null,
          status: record.animal.status,
        }
      : null;

    const recentHealthRecords =
      record.animal?.healthRecords?.map((hr) => ({
        id: hr.id,
        eventType: hr.eventType,
        severity: hr.severity,
        symptoms: hr.symptoms,
        diagnosis: hr.diagnosis,
        treatment: hr.treatment,
        createdAt: hr.createdAt.toISOString(),
        resolvedAt: hr.resolvedAt ? hr.resolvedAt.toISOString() : null,
      })) ?? [];

    const recentVaccineRecords =
      record.animal?.vaccineRecords?.map((vr) => ({
        id: vr.id,
        type: vr.recordType,
        vaccineName: vr.vaccineName,
        administeredDate: vr.administeredAt.toISOString(),
        dosage: vr.doseAmount ? `${vr.doseAmount} ${vr.doseUnit}` : null,
      })) ?? [];

    return {
      id: record.id,
      farmerId: record.farmerId,
      vetId: record.vetId,
      farmId: record.farmId,
      animalId: record.animalId,
      chiefComplaint: record.chiefComplaint,
      mediaUrls: Array.isArray(record.mediaUrls)
        ? (record.mediaUrls as string[])
        : [],
      type: record.type as unknown as ConsultationType,
      status: record.status as unknown as ConsultationStatus,
      feeCents: record.feeCents,
      paymentStatus:
        (record.paymentStatus as unknown as ConsultationPaymentStatus) ??
        ConsultationPaymentStatus.UNPAID,
      paymentIntentId: record.paymentIntentId ?? null,
      currency: record.currency ?? "USD",
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      waitTimeMinutes,
      farmer: record.farmer
        ? {
            id: record.farmer.id,
            name: record.farmer.name,
            email: record.farmer.email,
          }
        : null,
      farmerPhone: record.farmer?.phone ?? null,
      vet: record.vet
        ? {
            id: record.vet.id,
            name: record.vet.name,
            email: record.vet.email,
          }
        : null,
      animal: record.animal
        ? {
            id: record.animal.id,
            name: record.animal.name ?? "",
            tagNumber: record.animal.tagNumber,
            species: record.animal.species,
          }
        : null,
      farm: record.farm ? { id: record.farm.id, name: record.farm.name } : null,
      farmType: record.farm?.farmType ?? null,
      animalDetails,
      recentHealthRecords,
      recentVaccineRecords,
    };
  }

  public async countActiveConsultationsByVet(vetId: string): Promise<number> {
    return this.prisma.consultation.count({
      where: {
        vetId,
        status: {
          in: [ConsultationStatus.ASSIGNED, ConsultationStatus.IN_PROGRESS],
        },
      },
    });
  }

  public async findConflictingConsultations(
    vetId: string,
    scheduledAt: Date,
    windowMinutes = 45,
  ): Promise<ConsultationEntity[]> {
    const windowMs = windowMinutes * 60 * 1000;
    const startTime = new Date(scheduledAt.getTime() - windowMs);
    const endTime = new Date(scheduledAt.getTime() + windowMs);

    const records = await this.prisma.consultation.findMany({
      where: {
        vetId,
        status: {
          in: [ConsultationStatus.ASSIGNED, ConsultationStatus.IN_PROGRESS],
        },
        scheduledAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      include: CONSULTATION_INCLUDE,
    });

    return records.map((r) => ConsultationEntity.fromPersistence(r));
  }
}
