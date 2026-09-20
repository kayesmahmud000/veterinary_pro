import {
  QuerySaasMetricsDto,
  SaasMetricsSummaryDto,
  SaasMetricsTrendDto,
} from "@vetralink/shared-types";

export const SUBSCRIPTION_METRICS_SERVICE = Symbol(
  "SUBSCRIPTION_METRICS_SERVICE",
);

export interface ISubscriptionMetricsService {
  getSummary(asOfDate?: Date): Promise<SaasMetricsSummaryDto>;
  getTrends(query?: QuerySaasMetricsDto): Promise<SaasMetricsTrendDto>;
}
