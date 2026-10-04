import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EnvService } from "./env.service";
import { EnvConfig } from "./env.schema";

describe("EnvService (env.service.ts)", () => {
  let service: EnvService;
  let configService: jest.Mocked<Partial<ConfigService<EnvConfig, true>>>;

  const mockEnvConfig: Partial<EnvConfig> = {
    NODE_ENV: "development",
    PORT: 3001,
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    DATABASE_REPLICA_URL: undefined,
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "12345678901234567890123456789012",
    JWT_REFRESH_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
    JWT_ACCESS_EXPIRATION: "15m",
    JWT_REFRESH_EXPIRATION: "7d",
    AES_PII_ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    HASH_PEPPER: "pepper_secret_16_chars",
    CORS_ORIGINS: "http://localhost:3000, http://localhost:3002",
    SLOW_QUERY_THRESHOLD_MS: 200,
    DB_CONNECT_RETRY_DELAY_MS: 1000,
    AWS_REGION: "us-east-1",
    S3_BUCKET_MEDIA: "vetralink-media-dev",
    S3_BUCKET_DELIVERIES: "vetralink-deliveries-dev",
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: keyof EnvConfig) => {
        return mockEnvConfig[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<EnvService>(EnvService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return typed values for environment accessors", () => {
    expect(service.nodeEnv).toBe("development");
    expect(service.port).toBe(3001);
    expect(service.databaseUrl).toBe("postgresql://user:pass@localhost:5432/db");
    expect(service.redisUrl).toBe("redis://localhost:6379");
    expect(service.jwtAccessSecret).toBe("12345678901234567890123456789012");
    expect(service.jwtRefreshSecret).toBe("abcdefghijklmnopqrstuvwxyz123456");
    expect(service.aesPiiEncryptionKey).toBe(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    expect(service.hashPepper).toBe("pepper_secret_16_chars");
    expect(service.slowQueryThresholdMs).toBe(200);
    expect(service.dbConnectRetryDelayMs).toBe(1000);
    expect(service.awsRegion).toBe("us-east-1");
    expect(service.s3BucketMedia).toBe("vetralink-media-dev");
  });

  it("should accurately evaluate environment booleans", () => {
    expect(service.isDevelopment).toBe(true);
    expect(service.isProduction).toBe(false);
    expect(service.isTest).toBe(false);
  });

  it("should parse comma-separated CORS_ORIGINS into a clean array", () => {
    expect(service.corsOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:3002",
    ]);
  });
});
