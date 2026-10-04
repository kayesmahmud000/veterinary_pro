import {
  DunningChannel,
  DunningScanResultDto,
  DunningStage,
  QueryDunningLogsDto,
  SubscriptionDunningLogDto,
  TriggerDunningScanDto,
} from "@vetralink/shared-types";

export const SUBSCRIPTION_DUNNING_SERVICE = Symbol(
  "SUBSCRIPTION_DUNNING_SERVICE",
);

export interface ISubscriptionDunningService {
  scanAndDispatchDunning(
    options?: TriggerDunningScanDto,
    traceId?: string,
  ): Promise<DunningScanResultDto>;

  dispatchDunningStage(params: {
    subscriptionId: string;
    stage: DunningStage;
    channel?: DunningChannel;
    gatewayInvoiceId?: string;
    traceId?: string;
  }): Promise<SubscriptionDunningLogDto>;

  getDunningLogs(
    query: QueryDunningLogsDto,
  ): Promise<{ items: SubscriptionDunningLogDto[]; total: number }>;
}
