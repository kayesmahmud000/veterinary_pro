import { Prisma } from "@prisma/client";
import { ConsultationMessageEntity } from "../entities/consultation-message.entity";

export const CONSULTATION_MESSAGE_REPOSITORY = Symbol(
  "CONSULTATION_MESSAGE_REPOSITORY",
);

export interface IConsultationMessageRepository {
  create(
    entity: ConsultationMessageEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<ConsultationMessageEntity>;

  findById(id: string): Promise<ConsultationMessageEntity | null>;

  findByConsultation(
    consultationId: string,
    page: number,
    limit: number,
    before?: Date,
  ): Promise<{ items: ConsultationMessageEntity[]; total: number }>;

  markAsRead(
    consultationId: string,
    messageIds: string[],
    readAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
}
