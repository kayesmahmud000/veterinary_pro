import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ClinicalNoteCategory } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationClinicalNoteEntity } from "../entities/consultation-clinical-note.entity";
import { IConsultationClinicalNoteRepository } from "./consultation-clinical-note.repository.interface";

const NOTE_INCLUDE = {
  authorVet: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class ConsultationClinicalNoteRepository
  implements IConsultationClinicalNoteRepository
{
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: ConsultationClinicalNoteEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationClinicalNoteEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationClinicalNote.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        authorVetId: entity.authorVetId,
        title: entity.title,
        content: entity.content,
        category: entity.category,
        isConfidential: entity.isConfidential,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: NOTE_INCLUDE,
    });

    return ConsultationClinicalNoteEntity.fromPersistence(record);
  }

  public async findById(
    id: string,
  ): Promise<ConsultationClinicalNoteEntity | null> {
    const record = await this.prisma.consultationClinicalNote.findUnique({
      where: { id },
      include: NOTE_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return ConsultationClinicalNoteEntity.fromPersistence(record);
  }

  public async findByConsultation(
    consultationId: string,
    category?: ClinicalNoteCategory,
    page = 1,
    limit = 50,
  ): Promise<{ items: ConsultationClinicalNoteEntity[]; total: number }> {
    const where: Prisma.ConsultationClinicalNoteWhereInput = {
      consultationId,
      ...(category ? { category } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.consultationClinicalNote.findMany({
        where,
        include: NOTE_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.consultationClinicalNote.count({ where }),
    ]);

    return {
      items: records.map((r) =>
        ConsultationClinicalNoteEntity.fromPersistence(r),
      ),
      total,
    };
  }

  public async update(
    entity: ConsultationClinicalNoteEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationClinicalNoteEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationClinicalNote.update({
      where: { id: entity.id },
      data: {
        title: entity.title,
        content: entity.content,
        category: entity.category,
        isConfidential: entity.isConfidential,
        updatedAt: entity.updatedAt,
      },
      include: NOTE_INCLUDE,
    });

    return ConsultationClinicalNoteEntity.fromPersistence(record);
  }

  public async delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    await client.consultationClinicalNote.delete({
      where: { id },
    });
    return true;
  }
}
