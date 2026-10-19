import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { Queue } from "bullmq";
import {
  platformQueues,
  platformSystemSchema,
  platformIntegrationsSchema,
  type PlatformSystem,
} from "@vetralink/shared-types";
import { EnvService } from "../../config";
import { PlatformRepository } from "./platform.repository";

@Injectable()
export class PlatformProbe {
  constructor(
    private readonly env: EnvService,
    private readonly repo: PlatformRepository,
  ) {}
  integrations() {
    const row = (name: string, provider: string, configured: boolean) => ({
      name,
      provider,
      status:
        provider === "MOCK"
          ? "MOCK"
          : configured
            ? "CONFIGURED_UNVERIFIED"
            : "NOT_CONFIGURED",
      fallbackPossible: false,
      externalTestAvailable: false,
    });
    const email = this.env.emailProvider;
    let sesInstalled = false;
    try {
      require.resolve("@aws-sdk/client-ses");
      sesInstalled = true;
    } catch {
      /* SES intentionally simulates when its optional SDK is absent. */
    }
    const emailRow = row(
      "EMAIL",
      email === "resend" ? "RESEND" : email === "ses" ? "SES" : "MOCK",
      email === "resend"
        ? !!this.env.resendApiKey
        : !!(this.env.awsAccessKeyId && this.env.awsSecretAccessKey),
    );
    if (email === "ses" && !sesInstalled) {
      emailRow.fallbackPossible = true;
      if (emailRow.status === "CONFIGURED_UNVERIFIED")
        emailRow.status = "SIMULATED";
    }
    const storage = row(
      "STORAGE",
      "S3",
      !!(
        this.env.awsAccessKeyId &&
        this.env.awsSecretAccessKey &&
        this.env.s3BucketMedia
      ),
    );
    if (storage.status === "NOT_CONFIGURED" && this.env.s3BucketMedia)
      storage.status = "CREDENTIAL_CHAIN_UNVERIFIED";
    const video = row("VIDEO", "DAILY", !!this.env.dailyApiKey);
    video.fallbackPossible = true;
    if (!this.env.dailyApiKey) video.status = "MOCK";
    const stripe = row(
      "STRIPE",
      "STRIPE",
      !!(this.env.stripeSecretKey && this.env.stripeWebhookSecret),
    );
    stripe.fallbackPossible = true;
    if (!this.env.stripeSecretKey) stripe.status = "MOCK";
    return platformIntegrationsSchema.parse({
      checkedAt: new Date().toISOString(),
      items: [
        emailRow,
        storage,
        stripe,
        video,
        row("SMS", "MOCK", false),
        row("PUSH", "MOCK", false),
        row("CLINICAL", "MOCK", false),
      ],
    });
  }
  async system(): Promise<PlatformSystem> {
    const checkedAt = new Date().toISOString();
    const database = this.repo.databaseProbe();
    const unavailable: PlatformSystem["queues"] = platformQueues.map(
      (name) => ({
        name,
        status: "UNAVAILABLE",
        counts: null,
        registeredWorkers: null,
      }),
    );
    let queues = unavailable;
    let redis: PlatformSystem["redis"] = "UNAVAILABLE";
    const connection = new Redis(this.env.redisUrl, {
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    connection.on("error", () => {
      /* Only fixed statuses leave this boundary. */
    });
    const handles: Queue[] = [];
    const url = new URL(this.env.redisUrl);
    const queueConnection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    };
    try {
      await connection.connect();
      if ((await connection.ping()) === "PONG") redis = "UP";
      queues = await Promise.all(
        platformQueues.map(async (name) => {
          const queue = new Queue(name, {
            connection: queueConnection,
            skipVersionCheck: true,
            skipMetasUpdate: true,
          });
          queue.on("error", () => {});
          handles.push(queue);
          try {
            const [result, registeredWorkers] = await Promise.all([
              queue.getJobCounts(
                "waiting",
                "active",
                "delayed",
                "failed",
                "completed",
              ),
              queue.getWorkersCount(),
            ]);
            return {
              name,
              status: "OBSERVED" as const,
              counts: {
                waiting: result.waiting,
                active: result.active,
                delayed: result.delayed,
                failed: result.failed,
                completed: result.completed,
              },
              registeredWorkers,
            };
          } catch {
            return {
              name,
              status: "UNAVAILABLE" as const,
              counts: null,
              registeredWorkers: null,
            };
          }
        }),
      );
    } catch {
      /* Preserve unavailable status, without exposing provider exceptions. */
    } finally {
      connection.disconnect();
      await Promise.all(
        handles.map((q) => q.disconnect().catch(() => undefined)),
      );
    }
    const roleEmail = await database;
    return platformSystemSchema.parse({
      checkedAt,
      database: roleEmail ? "UP" : "UNAVAILABLE",
      redis,
      queues,
      roleEmail,
    });
  }
}
