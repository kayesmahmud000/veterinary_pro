import { BlockList, isIP } from "node:net";
import { z } from "zod";

// Environment strings must not use Boolean("false").
export const recoveryBoolean = z.preprocess(
  (value) => value === "true" ? true : value === "false" ? false : value,
  z.boolean().default(false),
);

export const recoveryProxyCidrs = z.string().max(2048).default("")
  .transform((value) => value.trim() ? value.split(",").map((part) => part.trim()) : [])
  .refine((values) => values.every((value) => {
    const [address, prefix, extra] = value.split("/");
    const version = isIP(address);
    return extra === undefined && version !== 0 && /^\d{1,3}$/.test(prefix ?? "") &&
      Number(prefix) <= (version === 4 ? 32 : 128);
  }), "Recovery trusted proxies must be IP CIDRs.");

function loopback(hostname: string): boolean {
  const address = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (address === "localhost" || address.endsWith(".localhost")) return true;
  const version = isIP(address);
  if (!version) return false;
  const local = new BlockList();
  local.addSubnet("127.0.0.0", 8, "ipv4");
  local.addAddress("::1", "ipv6");
  return local.check(address, version === 4 ? "ipv4" : "ipv6");
}

export function validateRecoveryConfig(data: {
  NODE_ENV: string; ACCOUNT_RECOVERY_ENABLED: boolean;
  ACCOUNT_RECOVERY_TEST_TRANSPORT: boolean; WEB_BASE_URL: string;
  EMAIL_PROVIDER: string; RESEND_API_KEY?: string; EMAIL_FROM: string;
}, ctx: z.RefinementCtx): void {
  const deployed = data.NODE_ENV === "production" || data.NODE_ENV === "staging";
  const issue = (field: string, message: string) => ctx.addIssue({
    code: z.ZodIssueCode.custom, path: [field], message,
  });
  if (deployed && data.ACCOUNT_RECOVERY_TEST_TRANSPORT)
    issue("ACCOUNT_RECOVERY_TEST_TRANSPORT", "Recovery test transport is forbidden in production/staging.");
  if (!data.ACCOUNT_RECOVERY_ENABLED) return;

  let origin: URL;
  try {
    origin = new URL(data.WEB_BASE_URL);
  } catch {
    issue("WEB_BASE_URL", "Recovery requires a valid canonical origin.");
    return;
  }
  const local = loopback(origin.hostname);
  const canonical = !origin.username && !origin.password && origin.pathname === "/" &&
    !data.WEB_BASE_URL.includes("?") && !data.WEB_BASE_URL.includes("#");
  const secure = origin.protocol === "https:" && (!deployed || !local);
  const localTest = !deployed && data.ACCOUNT_RECOVERY_TEST_TRANSPORT && local && origin.protocol === "http:";
  if (!canonical || (!secure && !localTest))
    issue("WEB_BASE_URL", "Recovery requires a canonical HTTPS origin; HTTP is restricted to explicit loopback tests.");
  if (!data.ACCOUNT_RECOVERY_TEST_TRANSPORT) {
    if (data.EMAIL_PROVIDER !== "resend")
      issue("EMAIL_PROVIDER", "Recovery supports only the real Resend transport.");
    if (!data.RESEND_API_KEY?.trim())
      issue("RESEND_API_KEY", "A configured Resend key is required for recovery.");
    if (!data.EMAIL_FROM.trim())
      issue("EMAIL_FROM", "A configured sender is required for recovery.");
  }
}
