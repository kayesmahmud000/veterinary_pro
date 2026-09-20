import { Prisma } from "@prisma/client";
import { PrescriptionEntity } from "../entities/prescription.entity";

export const PRESCRIPTION_REPOSITORY = Symbol("PRESCRIPTION_REPOSITORY");

export interface IPrescriptionRepository {
  create(
    entity: PrescriptionEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PrescriptionEntity>;

  findById(id: string): Promise<PrescriptionEntity | null>;

  findByConsultationId(
    consultationId: string,
  ): Promise<PrescriptionEntity | null>;

  save(
    entity: PrescriptionEntity,
    tx?: Prisma.TransactionClient,
  ): Promise<PrescriptionEntity>;
}
