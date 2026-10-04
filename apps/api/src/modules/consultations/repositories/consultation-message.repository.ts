import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationMessageEntity } from "../entities/consultation-message.entity";
import { IConsultationMessageRepository } from "./consultation-message.repository.interface";

const MESSAGE_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} as const;

@Injectable()
export class ConsultationMessageRepository
  implements IConsultationMessageRepository
{
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: ConsultationMessageEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationMessageEntity> {
    const client = tx ?? this.prisma;
    const record = await client.consultationMessage.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        senderId: entity.senderId,
        content: entity.content,
        mediaUrls: entity.mediaUrls as unknown as Prisma.InputJsonValue,
        messageType: entity.messageType,
        readAt: entity.readAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      include: MESSAGE_INCLUDE,
    });

    return ConsultationMessageEntity.fromPersistence(record);
  }

  public async findById(id: string): Promise<ConsultationMessageEntity | null> {
    const record = await this.prisma.consultationMessage.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE,
    });

    if (!record) {
      return null;
    }

    return ConsultationMessageEntity.fromPersistence(record);
  }

  public async findByConsultation(
    consultationId: string,
    page = 1,
    limit = 50,
    before?: Date,
  ): Promise<{ items: ConsultationMessageEntity[]; total: number }> {
    const where: Prisma.ConsultationMessageWhereInput = {
      consultationId,
      ...(before ? { createdAt: { lt: before } } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.consultationMessage.findMany({
        where,
        include: MESSAGE_INCLUDE,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.consultationMessage.count({ where }),
    ]);

    return {
      items: records.map((r) => ConsultationMessageEntity.fromPersistence(r)),
      total,
    };
  }

  public async markAsRead(
    consultationId: string,
    messageIds: string[],
    readAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.consultationMessage.updateMany({
      where: {
        consultationId,
        id: { in: messageIds },
        readAt: null,
      },
      data: {
        readAt,
      },
    });

    return result.count;
  }
}
