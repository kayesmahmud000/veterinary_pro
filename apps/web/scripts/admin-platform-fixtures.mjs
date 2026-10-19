export const platformId = "d8000000-0000-4000-8000-000000000201";
export const platformDate = "2026-10-19T00:00:00Z";
export const platformSettingsFixture = {
  organizationBn: "পরীক্ষার প্রতিষ্ঠান",
  organizationEn: "Synthetic organization",
  supportEmail: "synthetic@example.test",
  reportTimezone: "Asia/Dhaka",
  version: 1,
  updatedAt: platformDate,
};
const queues = [
  "transactional-mail",
  "video-transcode",
  "subscription-dunning",
  "watermark",
  "animal-import",
  "milk-anomaly-detection",
  "vaccine-preventative-reminders",
  "health-incident-escalation",
];
export const platformSystemFixture = {
  checkedAt: platformDate,
  database: "UP",
  redis: "UNAVAILABLE",
  roleEmail: { pending: 4, failed: 2 },
  queues: queues.map((name) => ({
    name,
    status: "UNAVAILABLE",
    counts: null,
    registeredWorkers: null,
  })),
};
export const platformIntegrationFixture = {
  checkedAt: platformDate,
  items: [
    ["EMAIL", "MOCK", "MOCK"],
    ["STORAGE", "S3", "CONFIGURED_UNVERIFIED"],
    ["STRIPE", "STRIPE", "NOT_CONFIGURED"],
    ["VIDEO", "DAILY", "MOCK"],
    ["SMS", "MOCK", "MOCK"],
    ["PUSH", "MOCK", "MOCK"],
    ["CLINICAL", "MOCK", "MOCK"],
  ].map(([name, provider, status]) => ({
    name,
    provider,
    status,
    fallbackPossible: name === "VIDEO",
    externalTestAvailable: false,
  })),
};
export function platformReportFixture(
  query,
  settings = platformSettingsFixture,
) {
  const { version, updatedAt, ...branding } = settings;
  const offset = query.timezone === "Asia/Dhaka" ? "+06:00" : "Z";
  return {
    schemaVersion: 1,
    generatedAt: platformDate,
    range: {
      ...query,
      startInstant: new Date(query.from + "T00:00:00" + offset).toISOString(),
      endInstant: new Date(query.to + "T00:00:00" + offset).toISOString(),
    },
    branding,
    totals: { accounts: 1200, farms: 250, pendingRoleRequests: 7 },
    subscriptions: {
      status: [
        { status: "ACTIVE", count: 230 },
        { status: "PAST_DUE", count: 5 },
      ],
      tiers: [
        { tier: "STARTER", count: 200 },
        { tier: "PRO", count: 35 },
      ],
      estimatedMrr: {
        currency: "USD",
        totalMinor: "1234567",
        basis: "CURRENT_LOCAL_PLAN_ESTIMATE",
      },
      created: [{ period: query.from.slice(0, 7), count: 12 }],
    },
    orders: [
      {
        currency: "BDT",
        status: "COMPLETED",
        count: 2,
        totalMinor: "4294967294",
      },
      {
        currency: "USD",
        status: "COMPLETED",
        count: 1,
        totalMinor: "9007199254740993",
      },
    ],
    orderMonths: [
      {
        currency: "BDT",
        status: "COMPLETED",
        count: 2,
        totalMinor: "4294967294",
        period: query.from.slice(0, 7),
      },
    ],
    support: [{ status: "OPEN", count: 4 }],
    consultations: [{ status: "SUBMITTED", count: 10 }],
  };
}
export function platformAuditFixture(query) {
  const offset = query.timezone === "Asia/Dhaka" ? "+06:00" : "Z";
  return {
    exportId: platformId,
    generatedAt: platformDate,
    query,
    items: [
      {
        id: platformId,
        actorId: query.actorId || platformId,
        action: query.action || "USER_SUSPENDED",
        entityId: query.entityId || platformId,
        entityType: query.entityType || "User",
        traceId: platformId,
        createdAt: new Date(query.from + "T00:00:00" + offset).toISOString(),
      },
    ],
    nextCursor: null,
    truncated: false,
  };
}
