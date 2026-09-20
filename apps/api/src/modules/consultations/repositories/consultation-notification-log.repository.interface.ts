import { QueryVetNotificationsDto } from "@vetralink/shared-types";
import { ConsultationNotificationLogEntity } from "../entities/consultation-notification-log.entity";

export const CONSULTATION_NOTIFICATION_LOG_REPOSITORY = Symbol(
  "CONSULTATION_NOTIFICATION_LOG_REPOSITORY",
);

export interface IConsultationNotificationLogRepository {
  create(
    entity: ConsultationNotificationLogEntity,
  ): Promise<ConsultationNotificationLogEntity>;
  findById(id: string): Promise<ConsultationNotificationLogEntity | null>;
  save(
    entity: ConsultationNotificationLogEntity,
  ): Promise<ConsultationNotificationLogEntity>;
  findByVet(
    vetId: string,
    query: QueryVetNotificationsDto,
  ): Promise<{
    items: ConsultationNotificationLogEntity[];
    total: number;
    unreadCount: number;
  }>;
  findByConsultation(
    consultationId: string,
  ): Promise<ConsultationNotificationLogEntity[]>;
}
