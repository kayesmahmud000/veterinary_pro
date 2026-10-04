import {
  ConsultationNotificationLogDto,
  ConsultationNotificationResultDto,
  NotifyVetDto,
  PaginatedVetNotificationsDto,
  QueryVetNotificationsDto,
} from "@vetralink/shared-types";
import { Observable } from "rxjs";

export const CONSULTATION_NOTIFICATION_SERVICE = Symbol(
  "CONSULTATION_NOTIFICATION_SERVICE",
);

export interface ConsultationSseEvent {
  data: ConsultationNotificationLogDto;
  type?: string;
  id?: string;
  retry?: number;
}

export interface IConsultationNotificationService {
  dispatchAssignmentNotification(
    consultationId: string,
    vetId: string,
    options?: NotifyVetDto & { traceId?: string },
  ): Promise<ConsultationNotificationResultDto>;

  getVetNotifications(
    vetId: string,
    query: QueryVetNotificationsDto,
  ): Promise<PaginatedVetNotificationsDto>;

  markAsRead(
    notificationId: string,
    vetId: string,
  ): Promise<ConsultationNotificationLogDto>;

  getNotificationStream(vetId: string): Observable<ConsultationSseEvent>;
}
