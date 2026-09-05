import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://:redis_secret_dev_pass@localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32).default("dev_jwt_access_secret_minimum_32_characters_long"),
  JWT_REFRESH_SECRET: z.string().min(32).default("dev_jwt_refresh_secret_minimum_32_characters_long"),
  AES_PII_ENCRYPTION_KEY: z.string().length(64).default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
  HASH_PEPPER: z.string().min(16).default("dev_phone_hash_pepper_key_16"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    console.error("❌ Environment validation error:", JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Invalid application environment configuration.");
  }
  return parsed.data;
}
