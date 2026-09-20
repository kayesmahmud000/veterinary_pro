import {
  DunningChannel,
  DunningStage,
  TriggerDunningScanDto,
} from "@vetralink/shared-types";

export const SUBSCRIPTION_DUNNING_QUEUE = "subscription-dunning";
export const SUBSCRIPTION_DUNNING_QUEUE_SERVICE = Symbol(
  "SUBSCRIPTION_DUNNING_QUEUE_SERVICE",
);

export interface ISubscriptionDunningQueueService {
  dispatchScan(
    options?: TriggerDunningScanDto,
    traceId?: string,
  ): Promise<string>;

  dispatchStage(params: {
    subscriptionId: string;
    stage: DunningStage;
    channel?: DunningChannel;
    gatewayInvoiceId?: string;
    traceId?: string;
  }): Promise<string>;
}
