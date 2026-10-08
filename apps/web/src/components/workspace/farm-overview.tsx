"use client";
import { useState, type ReactNode } from "react";
import type { z } from "zod";
import { FarmType } from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getFarmMessages } from "@/lib/i18n/farm";
import { getWorkspaceShellMessages } from "@/lib/i18n/workspace-shell";
import {
  animalListSchema,
  milkAnalyticsSchema,
  financeSummarySchema,
  vaccinationScheduleSchema,
  accessStatusSchema,
  quotaSchema,
} from "@/lib/workspace/farm-contracts";
import {
  getReportingPeriod,
  projectAnimalCount,
  projectMilkYield,
} from "@/lib/workspace/farm-data";
import { useFarmContext } from "./farm-context";
import { useRemote } from "./workspace-ui";
function Metric<T>({
  label,
  path,
  schema,
  render,
}: {
  label: string;
  path: string;
  schema: z.ZodType<T, any, any>;
  render: (data: T) => ReactNode;
}) {
  const remote = useRemote(path, schema),
    auth = useAuth(),
    t = getWorkspaceShellMessages(auth.locale);
  return (
    <Card data-farm-metric={path.split("/").slice(2).join("/")}>
      <CardHeader>
        <h3 className="m-0 text-sm font-medium text-muted">{label}</h3>
      </CardHeader>
      <CardContent>
        {remote.loading ? (
          <p role="status" className="m-0 text-sm">
            {t.loading}
          </p>
        ) : remote.code ? (
          <>
            <p className="mt-0 text-sm" role="alert">
              {[401, 403].includes(remote.status) ? t.denied : t.unavailable}
            </p>
            <button
              type="button"
              className="min-h-11 border-0 bg-transparent text-sm font-semibold text-green"
              onClick={remote.reload}
            >
              {t.retry}
            </button>
          </>
        ) : remote.data !== undefined ? (
          render(remote.data)
        ) : null}
      </CardContent>
    </Card>
  );
}
export function FarmOverview() {
  const auth = useAuth(),
    { farm, farmId } = useFarmContext(),
    t = getFarmMessages(auth.locale),
    [dates] = useState(() => getReportingPeriod()),
    base = `farms/${farmId}`,
    n = (value: number) =>
      new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
        maximumFractionDigits: 2,
      }).format(value);
  const value = (text: string) => (
    <p className="m-0 break-words text-3xl font-medium">{text}</p>
  );
  return (
    <>
      <p className="mb-6 text-xs leading-6 text-muted">
        {t.reporting} {dates.localDate}
      </p>
      <div className="grid grid-cols-1 gap-5 min-[768px]:grid-cols-2 min-[1440px]:grid-cols-3">
        <Metric
          label={t.animals}
          path={`${base}/animals?page=1&limit=1`}
          schema={animalListSchema}
          render={(data) => value(n(projectAnimalCount(data)))}
        />
        {[FarmType.DAIRY, FarmType.MIXED].includes(farm!.farmType) && (
          <Metric
            label={`${t.milk} · ${dates.reportDate} UTC`}
            path={`${base}/milk/analytics?startDate=${dates.reportDate}&endDate=${dates.reportDate}&entryType=ALL`}
            schema={milkAnalyticsSchema}
            render={(data) =>
              projectMilkYield(data).state === "empty" ? (
                <p className="m-0 text-sm">{t.noMilk}</p>
              ) : (
                value(`${n(data.summary.totalYieldLiters)} ${t.liters}`)
              )
            }
          />
        )}
        <Metric
          label={t.vaccines}
          path={`${base}/vaccinations/schedule?daysAhead=7&asOfDate=${dates.reportDate}`}
          schema={vaccinationScheduleSchema}
          render={(data) => (
            <>
              {value(n(data.dueNext7Days))}
              <p className="mb-0 mt-3 text-sm text-muted">
                {t.overdue}: {n(data.overdueCount)}
              </p>
              {data.upcomingEvents.length > 0 && (
                <ul className="mb-0 pl-5 text-sm">
                  {data.upcomingEvents.map((event) => (
                    <li key={event.id}>
                      {event.vaccineName} ·{" "}
                      {event.nextDueDate?.slice(0, 10) ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        />
        <Metric
          label={t.profit}
          path={`${base}/finance/summary?startDate=${dates.monthStart}&endDate=${dates.reportDate}`}
          schema={financeSummarySchema}
          render={(data) => (
            <>
              {value(`${n(data.netProfit)} ${data.currency}`)}
              <p className="mb-0 mt-3 text-xs text-muted">
                {data.startDate} – {data.endDate} UTC
              </p>
            </>
          )}
        />
        <Metric
          label={t.access}
          path={`${base}/access-status`}
          schema={accessStatusSchema}
          render={(data) => (
            <p className="m-0 font-semibold">
              {
                {
                  FULL_ACCESS: t.full,
                  GRACE_PERIOD: t.grace,
                  READ_ONLY: t.readonly,
                  SUSPENDED: t.suspended,
                }[data.accessMode]
              }
            </p>
          )}
        />
        <Metric
          label={t.quota}
          path={`${base}/quota`}
          schema={quotaSchema}
          render={(data) => (
            <>
              <p className="m-0 font-semibold">{data.planName}</p>
              <p className="mb-0 mt-3 text-sm">
                {n(data.quotas.animals.currentUsage)} /{" "}
                {data.quotas.animals.isUnlimited
                  ? t.unlimited
                  : n(data.quotas.animals.limit)}
              </p>
            </>
          )}
        />
      </div>
    </>
  );
}
