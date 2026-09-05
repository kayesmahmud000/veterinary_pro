import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { DatabaseHealthResult, IPrismaService } from "./interfaces/prisma.interface";

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, "query" | "error" | "info" | "warn">
  implements OnModuleInit, OnModuleDestroy, IPrismaService
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryThresholdMs: number;
  private readonly connectionRetryBaseDelayMs: number;
  private readonly isProduction: boolean;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const nodeEnv =
      configService?.get<string>("NODE_ENV") ?? process.env["NODE_ENV"] ?? "development";
    const isProd = nodeEnv === "production";

    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "info" },
        { emit: "stdout", level: "warn" },
        { emit: "stdout", level: "error" },
      ],
    });

    this.isProduction = isProd;
    const configuredThreshold = this.configService?.get<string>("SLOW_QUERY_THRESHOLD_MS");
    this.slowQueryThresholdMs = configuredThreshold
      ? parseInt(configuredThreshold, 10)
      : 200;

    const configuredRetryDelay = this.configService?.get<string>("DB_CONNECT_RETRY_DELAY_MS");
    this.connectionRetryBaseDelayMs = configuredRetryDelay
      ? parseInt(configuredRetryDelay, 10)
      : 1000;

    this.registerQueryMetrics();
  }

  private registerQueryMetrics(): void {
    this.$on("query", (event: Prisma.QueryEvent) => {
      if (event.duration >= this.slowQueryThresholdMs) {
        const queryText = this.isProduction
          ? event.query.replace(/\s+/g, " ").trim()
          : `${event.query.replace(/\s+/g, " ").trim()} [params: ${event.params}]`;

        this.logger.warn(
          `⚡ SLOW QUERY (${event.duration}ms): ${queryText}`
        );
      } else if (!this.isProduction) {
        this.logger.debug(
          `Query (${event.duration}ms): ${event.query.replace(/\s+/g, " ").trim()}`
        );
      }
    });
  }

  async onModuleInit(): Promise<void> {
    const maxRetries = 3;
    const baseDelayMs = this.connectionRetryBaseDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log("✅ PostgreSQL connection pool established via Prisma.");
        return;
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Database connection attempt ${attempt}/${maxRetries} failed: ${errMessage}. Retrying in ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(
            `❌ Failed to connect to PostgreSQL after ${maxRetries} attempts: ${errMessage}`
          );
          throw error;
        }
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log("🔌 PostgreSQL connection pool closed gracefully.");
    } catch (error) {
      this.logger.error("Error during PostgreSQL disconnection:", error);
    }
  }

  async ping(): Promise<DatabaseHealthResult> {
    const start = Date.now();
    try {
      await this.$queryRawUnsafe("SELECT 1");
      const latencyMs = Date.now() - start;
      return {
        status: "up",
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health probe failed (${latencyMs}ms): ${errorMessage}`);
      return {
        status: "down",
        latencyMs,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    const result = await this.ping();
    return result.status === "up";
  }
}
