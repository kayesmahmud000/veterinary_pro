import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "./env.schema";

export interface IEnvService {
  readonly nodeEnv: string;
  readonly port: number;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly databaseUrl: string;
  readonly databaseReplicaUrl?: string;
  readonly redisUrl: string;
  readonly jwtAccessSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessExpiration: string;
  readonly jwtRefreshExpiration: string;
  readonly aesPiiEncryptionKey: string;
  readonly hashPepper: string;
  readonly corsOrigins: string[];
  readonly slowQueryThresholdMs: number;
  readonly dbConnectRetryDelayMs: number;
  readonly awsRegion: string;
  readonly awsAccessKeyId?: string;
  readonly awsSecretAccessKey?: string;
  readonly s3BucketMedia: string;
  readonly s3BucketDeliveries: string;
  readonly s3Endpoint?: string;
  readonly s3ForcePathStyle: boolean;
  readonly stripeSecretKey?: string;
  readonly stripeWebhookSecret?: string;
  readonly mfsWebhookSecret: string;
  readonly dailyApiKey?: string;
  readonly hlsDrmKeySecret: string;
  readonly drmTokenExpirationSeconds: number;
  readonly cloudfrontDistributionDomain?: string;
  readonly cloudfrontKeyPairId?: string;
  readonly cloudfrontPrivateKey?: string;
  readonly cloudfrontUrlExpirationSeconds: number;
}

@Injectable()
export class EnvService implements IEnvService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get nodeEnv(): string {
    return this.configService.get("NODE_ENV", { infer: true });
  }

  get port(): number {
    return this.configService.get("PORT", { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === "development";
  }

  get isTest(): boolean {
    return this.nodeEnv === "test";
  }

  get databaseUrl(): string {
    return this.configService.get("DATABASE_URL", { infer: true });
  }

  get databaseReplicaUrl(): string | undefined {
    return this.configService.get("DATABASE_REPLICA_URL", { infer: true });
  }

  get redisUrl(): string {
    return this.configService.get("REDIS_URL", { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.configService.get("JWT_ACCESS_SECRET", { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.configService.get("JWT_REFRESH_SECRET", { infer: true });
  }

  get jwtAccessExpiration(): string {
    return this.configService.get("JWT_ACCESS_EXPIRATION", { infer: true });
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get("JWT_REFRESH_EXPIRATION", { infer: true });
  }

  get aesPiiEncryptionKey(): string {
    return this.configService.get("AES_PII_ENCRYPTION_KEY", { infer: true });
  }

  get hashPepper(): string {
    return this.configService.get("HASH_PEPPER", { infer: true });
  }

  get corsOrigins(): string[] {
    const raw = this.configService.get("CORS_ORIGINS", { infer: true }) || "";
    return raw
      .split(",")
      .map((origin: string) => origin.trim())
      .filter(Boolean);
  }

  get slowQueryThresholdMs(): number {
    return this.configService.get("SLOW_QUERY_THRESHOLD_MS", { infer: true });
  }

  get dbConnectRetryDelayMs(): number {
    return this.configService.get("DB_CONNECT_RETRY_DELAY_MS", { infer: true });
  }

  get awsRegion(): string {
    return this.configService.get("AWS_REGION", { infer: true });
  }

  get awsAccessKeyId(): string | undefined {
    return this.configService.get("AWS_ACCESS_KEY_ID", { infer: true });
  }

  get awsSecretAccessKey(): string | undefined {
    return this.configService.get("AWS_SECRET_ACCESS_KEY", { infer: true });
  }

  get s3BucketMedia(): string {
    return this.configService.get("S3_BUCKET_MEDIA", { infer: true });
  }

  get s3BucketDeliveries(): string {
    return this.configService.get("S3_BUCKET_DELIVERIES", { infer: true });
  }

  get s3Endpoint(): string | undefined {
    return this.configService.get("S3_ENDPOINT", { infer: true });
  }

  get s3ForcePathStyle(): boolean {
    return this.configService.get("S3_FORCE_PATH_STYLE", { infer: true });
  }

  get stripeSecretKey(): string | undefined {
    return this.configService.get("STRIPE_SECRET_KEY", { infer: true });
  }

  get stripeWebhookSecret(): string | undefined {
    return this.configService.get("STRIPE_WEBHOOK_SECRET", { infer: true });
  }

  get mfsWebhookSecret(): string {
    return this.configService.get("MFS_WEBHOOK_SECRET", { infer: true });
  }

  get dailyApiKey(): string | undefined {
    return this.configService.get("DAILY_API_KEY", { infer: true });
  }

  get hlsDrmKeySecret(): string {
    return this.configService.get("HLS_DRM_KEY_SECRET", { infer: true });
  }

  get drmTokenExpirationSeconds(): number {
    return this.configService.get("DRM_TOKEN_EXPIRATION_SECONDS", { infer: true });
  }

  get cloudfrontDistributionDomain(): string | undefined {
    return this.configService.get("CLOUDFRONT_DISTRIBUTION_DOMAIN", { infer: true });
  }

  get cloudfrontKeyPairId(): string | undefined {
    return this.configService.get("CLOUDFRONT_KEY_PAIR_ID", { infer: true });
  }

  get cloudfrontPrivateKey(): string | undefined {
    return this.configService.get("CLOUDFRONT_PRIVATE_KEY", { infer: true });
  }

  get cloudfrontUrlExpirationSeconds(): number {
    return this.configService.get("CLOUDFRONT_URL_EXPIRATION_SECONDS", { infer: true });
  }

  get emailProvider(): "resend" | "ses" | "mock" {
    return this.configService.get("EMAIL_PROVIDER", { infer: true });
  }

  get emailFrom(): string {
    return this.configService.get("EMAIL_FROM", { infer: true });
  }

  get resendApiKey(): string | undefined {
    return this.configService.get("RESEND_API_KEY", { infer: true });
  }

  get awsSesRegion(): string | undefined {
    return this.configService.get("AWS_SES_REGION", { infer: true });
  }

  get apiBaseUrl(): string {
    return this.configService.get("API_BASE_URL", { infer: true });
  }
}
