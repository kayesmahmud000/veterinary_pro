import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PrescriptionEntity } from "../entities/prescription.entity";
import { IPrescriptionRepository } from "./prescription.repository.interface";

const RX_INCLUDE = {
  vet: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class PrescriptionRepository implements IPrescriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: PrescriptionEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PrescriptionEntity> {
    const client = tx ?? this.prisma;
    const record = await client.prescription.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        vetId: entity.vetId,
        status: entity.status,
        diagnosis: entity.diagnosis,
        notes: entity.notes,
        medications: entity.medications as unknown as Prisma.InputJsonValue,
        pdfS3Key: entity.pdfS3Key,
        digitalSignatureHash: entity.digitalSignatureHash,
        signedAt: entity.signedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: RX_INCLUDE,
    });

    return PrescriptionEntity.fromPersistence(record);
  }

  public async findById(id: string): Promise<PrescriptionEntity | null> {
    const record = await this.prisma.prescription.findUnique({
      where: { id },
      include: RX_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return PrescriptionEntity.fromPersistence(record);
  }

  public async findByConsultationId(
    consultationId: string,
  ): Promise<PrescriptionEntity | null> {
    const record = await this.prisma.prescription.findUnique({
      where: { consultationId },
      include: RX_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return PrescriptionEntity.fromPersistence(record);
  }

  public async save(
    entity: PrescriptionEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PrescriptionEntity> {
    const client = tx ?? this.prisma;
    const record = await client.prescription.update({
      where: { id: entity.id },
      data: {
        status: entity.status,
        diagnosis: entity.diagnosis,
        notes: entity.notes,
        medications: entity.medications as unknown as Prisma.InputJsonValue,
        pdfS3Key: entity.pdfS3Key,
        digitalSignatureHash: entity.digitalSignatureHash,
        signedAt: entity.signedAt,
        updatedAt: entity.updatedAt,
      },
      include: RX_INCLUDE,
    });

    return PrescriptionEntity.fromPersistence(record);
  }
}
