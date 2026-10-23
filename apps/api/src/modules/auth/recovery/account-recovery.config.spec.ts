import { ConfigService } from "@nestjs/config";
import { EnvSchema } from "../../../config/env.schema";
import { EnvService } from "../../../config/env.service";

const base = { DATABASE_URL: "postgresql://synthetic:synthetic@localhost/test" };
const enabled = {
  ...base, ACCOUNT_RECOVERY_ENABLED: "true", EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "synthetic-provider-key", WEB_BASE_URL: "https://app.example.test",
};

describe("recovery environment safeguards", () => {
  it("defaults off and does not coerce false strings to true", () => {
    expect(EnvSchema.parse(base)).toMatchObject({ ACCOUNT_RECOVERY_ENABLED: false, ACCOUNT_RECOVERY_TEST_TRANSPORT: false, RECOVERY_TRUSTED_PROXY_CIDRS: [] });
    expect(EnvSchema.parse({ ...base, ACCOUNT_RECOVERY_ENABLED: "false" })).toMatchObject({ ACCOUNT_RECOVERY_ENABLED: false });
    expect(EnvSchema.safeParse({ ...base, ACCOUNT_RECOVERY_ENABLED: "yes" }).success).toBe(false);
  });

  it("allows explicit local test transport and validated proxy CIDRs", () => {
    const config = EnvSchema.parse({ ...base, ACCOUNT_RECOVERY_ENABLED: "true", ACCOUNT_RECOVERY_TEST_TRANSPORT: "true", RECOVERY_TRUSTED_PROXY_CIDRS: "127.0.0.1/32, ::1/128" });
    expect(config).toMatchObject({ ACCOUNT_RECOVERY_TEST_TRANSPORT: true, RECOVERY_TRUSTED_PROXY_CIDRS: ["127.0.0.1/32", "::1/128"] });
    const service = new EnvService(new ConfigService(config));
    expect(service).toMatchObject({ accountRecoveryEnabled: true, accountRecoveryTestTransport: true, recoveryTrustedProxyCidrs: ["127.0.0.1/32", "::1/128"] });
    for (const cidr of ["*", "example.test/32", "127.0.0.1/33", "::1/129", "127.0.0.1/-1", "127.0.0.1"]) {
      expect(EnvSchema.safeParse({ ...base, RECOVERY_TRUSTED_PROXY_CIDRS: cidr }).success).toBe(false);
    }
  });

  it("rejects unsupported or missing real transport and limits HTTP to loopback tests", () => {
    expect(EnvSchema.safeParse(enabled).success).toBe(true);
    for (const config of [
      { ...enabled, EMAIL_PROVIDER: "mock" }, { ...enabled, EMAIL_PROVIDER: "ses" },
      { ...enabled, RESEND_API_KEY: "" }, { ...enabled, WEB_BASE_URL: "http://app.example.test" },
      { ...enabled, WEB_BASE_URL: "http://localhost:3000" },
      { ...enabled, WEB_BASE_URL: "https://name:pass@app.example.test" },
      { ...enabled, WEB_BASE_URL: "https://app.example.test/path" },
      { ...enabled, WEB_BASE_URL: "https://app.example.test/?secret=value" },
      { ...enabled, WEB_BASE_URL: "https://app.example.test/#token=secret" },
      { ...enabled, WEB_BASE_URL: "invalid-url" },
    ]) expect(EnvSchema.safeParse(config).success).toBe(false);
  });

  it("never skips recovery production safeguards on Vercel", () => {
    const old = process.env["VERCEL"];
    process.env["VERCEL"] = "1";
    try {
      for (const patch of [
        { ACCOUNT_RECOVERY_TEST_TRANSPORT: "true" }, { WEB_BASE_URL: "https://127.0.0.1" },
        { WEB_BASE_URL: "https://[::1]" }, { WEB_BASE_URL: "https://localhost" },
        { WEB_BASE_URL: "https://localhost." },
        { EMAIL_PROVIDER: "ses" }, { RESEND_API_KEY: "" },
      ]) expect(EnvSchema.safeParse({ ...enabled, NODE_ENV: "production", ...patch }).success).toBe(false);
      expect(EnvSchema.safeParse({ ...base, NODE_ENV: "production", ACCOUNT_RECOVERY_TEST_TRANSPORT: "true" }).success).toBe(false);
    } finally {
      if (old === undefined) delete process.env["VERCEL"];
      else process.env["VERCEL"] = old;
    }
  });
});
