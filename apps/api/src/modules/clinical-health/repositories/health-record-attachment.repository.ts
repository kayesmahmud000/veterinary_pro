import { Injectable, Logger } from "@nestjs/common";
import { Prisma, HealthAttachmentStatus as PrismaHealthAttachmentStatus } from "@prisma/client";
import { HealthAttachmentStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthRecordAttachmentEntity } from "../entities/health-record-attachment.entity";
import { IHealthRecordAttachmentRepository } from "./health-record-attachment.repository.interface";

@Injectable()
export class HealthRecordAttachmentRepository
  implements IHealthRecordAttachmentRepository
{
  private readonly logger = new Logger(HealthRecordAttachmentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: HealthRecordAttachmentEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity> {
    const client = tx ?? this.prisma;

    const created = await client.healthRecordAttachment.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        healthRecordId: entity.healthRecordId,
        uploadedById: entity.uploadedById,
        fileName: entity.fileName,
        fileSizeBytes: entity.fileSizeBytes,
        mimeType: entity.mimeType,
        s3Key: entity.s3Key,
        status: entity.status as PrismaHealthAttachmentStatus,
        caption: entity.caption,
        confirmedAt: entity.confirmedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
    });

    return this.toDomainEntity(created);
  }

  public async update(
    entity: HealthRecordAttachmentEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity> {
    const client = tx ?? this.prisma;

    const updated = await client.healthRecordAttachment.update({
      where: {
        id: entity.id,
      },
      data: {
        status: entity.status as PrismaHealthAttachmentStatus,
        caption: entity.caption,
        confirmedAt: entity.confirmedAt,
        updatedAt: entity.updatedAt,
      },
    });

    return this.toDomainEntity(updated);
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity | null> {
    const client = tx ?? this.prisma;

    const record = await client.healthRecordAttachment.findFirst({
      where: {
        id,
        farmId,
      },
    });

    if (!record) {
      return null;
    }

    return this.toDomainEntity(record);
  }

  public async findByIncidentId(
    healthRecordId: string,
    farmId: string,
    status?: HealthAttachmentStatus,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity[]> {
    const client = tx ?? this.prisma;

    const where: Prisma.HealthRecordAttachmentWhereInput = {
      healthRecordId,
      farmId,
    };

    if (status) {
      where.status = status as PrismaHealthAttachmentStatus;
    }

    const records = await client.healthRecordAttachment.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map((record) => this.toDomainEntity(record));
  }

  public async delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.healthRecordAttachment.deleteMany({
      where: {
        id,
        farmId,
      },
    });
  }

  private toDomainEntity(
    raw: Prisma.HealthRecordAttachmentGetPayload<Record<string, never>>
  ): HealthRecordAttachmentEntity {
    return HealthRecordAttachmentEntity.reconstitute({
      id: raw.id,
      farmId: raw.farmId,
      healthRecordId: raw.healthRecordId,
      uploadedById: raw.uploadedById,
      fileName: raw.fileName,
      fileSizeBytes: raw.fileSizeBytes,
      mimeType: raw.mimeType,
      s3Key: raw.s3Key,
      status: raw.status as HealthAttachmentStatus,
      caption: raw.caption,
      confirmedAt: raw.confirmedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
