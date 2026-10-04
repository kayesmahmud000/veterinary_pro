import { z } from "zod";

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "staging", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
    DATABASE_URL: z
      .string()
      .url("DATABASE_URL must be a valid PostgreSQL connection URL"),
    DATABASE_REPLICA_URL: z
      .string()
      .url("DATABASE_REPLICA_URL must be a valid connection URL")
      .optional(),
    REDIS_URL: z
      .string()
      .url("REDIS_URL must be a valid Redis connection URL")
      .default("redis://:redis_secret_dev_pass@localhost:6379"),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters long")
      .default("dev_jwt_access_secret_minimum_32_characters_long"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters long")
      .default("dev_jwt_refresh_secret_minimum_32_characters_long"),
    JWT_ACCESS_EXPIRATION: z.string().default("15m"),
    JWT_REFRESH_EXPIRATION: z.string().default("7d"),
    AES_PII_ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[0-9a-fA-F]{64}$/,
        "AES_PII_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)"
      )
      .default(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      ),
    HASH_PEPPER: z
      .string()
      .min(16, "HASH_PEPPER must be at least 16 characters long")
      .default("dev_phone_hash_pepper_key_16"),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().positive().default(200),
    DB_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_MEDIA: z.string().default("vetralink-media-dev"),
    S3_BUCKET_DELIVERIES: z.string().default("vetralink-deliveries-dev"),
    S3_ENDPOINT: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    DAILY_API_KEY: z.string().optional(),
    MFS_WEBHOOK_SECRET: z
      .string()
      .min(16, "MFS_WEBHOOK_SECRET must be at least 16 characters long")
      .default("dev_mfs_webhook_secret_key_32_chars"),
    HLS_DRM_KEY_SECRET: z
      .string()
      .min(32, "HLS_DRM_KEY_SECRET must be at least 32 characters long")
      .default("dev_hls_drm_key_master_secret_32_chars_long"),
    DRM_TOKEN_EXPIRATION_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(600),
    CLOUDFRONT_DISTRIBUTION_DOMAIN: z.string().optional(),
    CLOUDFRONT_KEY_PAIR_ID: z.string().optional(),
    CLOUDFRONT_PRIVATE_KEY: z.string().optional(),
    CLOUDFRONT_URL_EXPIRATION_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    EMAIL_PROVIDER: z.enum(["resend", "ses", "mock"]).default("mock"),
    EMAIL_FROM: z.string().default("VetraLink Pro <orders@vetralink.pro>"),
    RESEND_API_KEY: z.string().optional(),
    AWS_SES_REGION: z.string().optional(),
    API_BASE_URL: z.string().url().default("http://localhost:3001"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" || data.NODE_ENV === "staging") {
      if (!data.STRIPE_SECRET_KEY || !data.STRIPE_SECRET_KEY.startsWith("sk_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message:
            "STRIPE_SECRET_KEY is required in production/staging and must start with 'sk_'",
        });
      }
      if (
        !data.STRIPE_WEBHOOK_SECRET ||
        !data.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_WEBHOOK_SECRET"],
          message:
            "STRIPE_WEBHOOK_SECRET is required in production/staging and must start with 'whsec_'",
        });
      }
      if (!data.AWS_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_ACCESS_KEY_ID"],
          message: "AWS_ACCESS_KEY_ID is required in production/staging",
        });
      }
      if (!data.AWS_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_SECRET_ACCESS_KEY"],
          message: "AWS_SECRET_ACCESS_KEY is required in production/staging",
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = EnvSchema.safeParse(config);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    // Redacted structured logging without leaking values
    console.error("❌ Environment configuration validation failed:");
    for (const err of errorDetails) {
      console.error(`   - [${err.field}]: ${err.message}`);
    }

    throw new Error(
      `Invalid application environment configuration: ${errorDetails.map((e) => e.field).join(", ")}`
    );
  }

  return parsed.data;
}
