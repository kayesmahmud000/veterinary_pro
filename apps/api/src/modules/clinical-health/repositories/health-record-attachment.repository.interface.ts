import { Prisma } from "@prisma/client";
import { HealthAttachmentStatus } from "@vetralink/shared-types";
import { HealthRecordAttachmentEntity } from "../entities/health-record-attachment.entity";

export interface IHealthRecordAttachmentRepository {
  create(
    entity: HealthRecordAttachmentEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity>;

  update(
    entity: HealthRecordAttachmentEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity | null>;

  findByIncidentId(
    healthRecordId: string,
    farmId: string,
    status?: HealthAttachmentStatus,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordAttachmentEntity[]>;

  delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}

export const HEALTH_RECORD_ATTACHMENT_REPOSITORY =
  "HEALTH_RECORD_ATTACHMENT_REPOSITORY";
