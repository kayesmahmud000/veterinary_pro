import { validateEnv, EnvSchema } from "./env.schema";

describe("Environment Schema & Validation (env.schema.ts)", () => {
  const validDevConfig = {
    NODE_ENV: "development",
    PORT: "3001",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "12345678901234567890123456789012",
    JWT_REFRESH_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
    AES_PII_ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    HASH_PEPPER: "pepper_secret_16_chars",
    CORS_ORIGINS: "http://localhost:3000,http://localhost:3002",
  };

  it("should successfully validate and parse standard development configuration", () => {
    const config = validateEnv(validDevConfig);

    expect(config.NODE_ENV).toBe("development");
    expect(config.PORT).toBe(3001);
    expect(config.DATABASE_URL).toBe(validDevConfig.DATABASE_URL);
    expect(config.JWT_ACCESS_EXPIRATION).toBe("15m");
    expect(config.JWT_REFRESH_EXPIRATION).toBe("7d");
    expect(config.SLOW_QUERY_THRESHOLD_MS).toBe(200);
    expect(config.DB_CONNECT_RETRY_DELAY_MS).toBe(1000);
    expect(config.S3_BUCKET_MEDIA).toBe("vetralink-media-dev");
    expect(config.HLS_DRM_KEY_SECRET).toBe("dev_hls_drm_key_master_secret_32_chars_long");
    expect(config.DRM_TOKEN_EXPIRATION_SECONDS).toBe(600);
    expect(config.CLOUDFRONT_URL_EXPIRATION_SECONDS).toBe(3600);
    expect(config.CLOUDFRONT_DISTRIBUTION_DOMAIN).toBeUndefined();
  });

  it("should parse custom CloudFront configuration correctly", () => {
    const customConfig = {
      ...validDevConfig,
      CLOUDFRONT_DISTRIBUTION_DOMAIN: "cdn.vetralink.pro",
      CLOUDFRONT_KEY_PAIR_ID: "K2JC3XQRI3UW74",
      CLOUDFRONT_PRIVATE_KEY: "mock_pem_private_key",
      CLOUDFRONT_URL_EXPIRATION_SECONDS: "7200",
    };

    const config = validateEnv(customConfig);
    expect(config.CLOUDFRONT_DISTRIBUTION_DOMAIN).toBe("cdn.vetralink.pro");
    expect(config.CLOUDFRONT_KEY_PAIR_ID).toBe("K2JC3XQRI3UW74");
    expect(config.CLOUDFRONT_PRIVATE_KEY).toBe("mock_pem_private_key");
    expect(config.CLOUDFRONT_URL_EXPIRATION_SECONDS).toBe(7200);
  });

  it("should fail validation if DATABASE_URL is missing or invalid URL", () => {
    const invalidConfig = {
      ...validDevConfig,
      DATABASE_URL: "not-a-valid-url",
    };

    expect(() => validateEnv(invalidConfig)).toThrow(
      "Invalid application environment configuration: DATABASE_URL"
    );
  });

  it("should fail validation if AES_PII_ENCRYPTION_KEY is not a 64-hex character string", () => {
    // Too short (not 64 chars)
    const shortKeyConfig = {
      ...validDevConfig,
      AES_PII_ENCRYPTION_KEY: "0123456789abcdef",
    };
    expect(() => validateEnv(shortKeyConfig)).toThrow(
      "Invalid application environment configuration: AES_PII_ENCRYPTION_KEY"
    );

    // Invalid non-hex characters
    const nonHexConfig = {
      ...validDevConfig,
      AES_PII_ENCRYPTION_KEY:
        "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    };
    expect(() => validateEnv(nonHexConfig)).toThrow(
      "Invalid application environment configuration: AES_PII_ENCRYPTION_KEY"
    );
  });

  it("should fail validation if JWT secrets are shorter than 32 characters", () => {
    const shortJwtConfig = {
      ...validDevConfig,
      JWT_ACCESS_SECRET: "short_secret",
    };

    expect(() => validateEnv(shortJwtConfig)).toThrow(
      "Invalid application environment configuration: JWT_ACCESS_SECRET"
    );
  });

  it("should fail validation if PORT is outside 1024-65535", () => {
    const invalidPortConfig = {
      ...validDevConfig,
      PORT: "80",
    };

    expect(() => validateEnv(invalidPortConfig)).toThrow(
      "Invalid application environment configuration: PORT"
    );
  });

  describe("Production Conditional Validation", () => {
    const baseProdConfig = {
      ...validDevConfig,
      NODE_ENV: "production",
    };

    it("should fail in production if Stripe and AWS keys are missing", () => {
      expect(() => validateEnv(baseProdConfig)).toThrow(
        "Invalid application environment configuration: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
      );
    });

    it("should fail in production if STRIPE_SECRET_KEY does not start with sk_", () => {
      const invalidStripeConfig = {
        ...baseProdConfig,
        STRIPE_SECRET_KEY: "invalid_key",
        STRIPE_WEBHOOK_SECRET: "whsec_valid_secret",
        AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
        AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      };

      expect(() => validateEnv(invalidStripeConfig)).toThrow(
        "Invalid application environment configuration: STRIPE_SECRET_KEY"
      );
    });

    it("should succeed in production when all production-critical variables are present and valid", () => {
      const validProdConfig = {
        ...baseProdConfig,
        STRIPE_SECRET_KEY: "sk_live_valid_key_123456",
        STRIPE_WEBHOOK_SECRET: "whsec_valid_webhook_secret_123456",
        AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
        AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      };

      const result = validateEnv(validProdConfig);
      expect(result.NODE_ENV).toBe("production");
      expect(result.STRIPE_SECRET_KEY).toBe("sk_live_valid_key_123456");
      expect(result.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    });
  });
});
