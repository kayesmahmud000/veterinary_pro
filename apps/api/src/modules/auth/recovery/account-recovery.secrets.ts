import { Injectable } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import { AccountRecoveryJob } from "@prisma/client";
import { z } from "zod";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { EnvService } from "../../../config/env.service";
import { AccountRecoveryException } from "./account-recovery.errors";

const context = {
  jobId: z.string().uuid(), email: z.string().email().max(254),
  emailHmac: z.string().regex(/^[0-9a-f]{64}$/), locale: z.enum(["bn", "en"]),
  origin: z.string().url(), originVersion: z.string().regex(/^[0-9a-f]{64}$/),
  templateVersion: z.literal(1),
};
const payloadSchema = z.discriminatedUnion("kind", [
  z.object({ ...context, kind: z.literal("RESET_REQUEST") }).strict(),
  z.object({ ...context, kind: z.literal("RESET_LINK"), credentialId: z.string().uuid(),
    token: z.string().length(64).regex(/^[0-9a-f]{64}$/), authorizationVersion: z.number().int().nonnegative() }).strict(),
  z.object({ ...context, kind: z.literal("PASSWORD_CHANGED"), userId: z.string().uuid(),
    authorizationVersion: z.number().int().nonnegative() }).strict(),
]);
export type RecoveryPayload = z.infer<typeof payloadSchema>;
export interface RecoveryPayloadContext {
  jobId: string; email: string; emailHmac: string; locale: "bn" | "en";
  origin: string; originVersion: string; templateVersion: 1;
}

@Injectable()
export class AccountRecoverySecrets {
  constructor(private readonly pii: PiiCryptoService, private readonly env: EnvService) {}

  emailHmac(email: string): string {
    return this.hmac("recovery-email", email.trim().toLowerCase());
  }
  hashToken(token: string): string {
    return createHash("sha256").update(`password-reset:${token}`, "utf8").digest("hex");
  }
  context(jobId: string, email: string, locale: "bn" | "en"): RecoveryPayloadContext {
    const origin = new URL(this.env.webBaseUrl).origin;
    return { jobId, email, locale, emailHmac: this.emailHmac(email), origin,
      originVersion: this.hmac("recovery-origin", origin), templateVersion: 1 };
  }
  seal(payload: RecoveryPayload): string {
    return this.pii.encrypt(JSON.stringify(payloadSchema.parse(payload)));
  }
  openPayload(job: AccountRecoveryJob): RecoveryPayload {
    try {
      if (!job.payload) throw new Error("Missing payload");
      const payload = payloadSchema.parse(JSON.parse(this.pii.decrypt(job.payload)));
      if (payload.jobId !== job.id || payload.locale !== job.locale ||
        payload.email !== payload.email.trim().toLowerCase() ||
        this.emailHmac(payload.email) !== job.emailHmac || payload.emailHmac !== job.emailHmac ||
        payload.originVersion !== job.originVersion || payload.templateVersion !== job.templateVersion ||
        payload.origin !== new URL(this.env.webBaseUrl).origin ||
        this.hmac("recovery-origin", payload.origin) !== job.originVersion ||
        (job.kind === "PASSWORD_CHANGED") !== (payload.kind === "PASSWORD_CHANGED") ||
        (payload.kind === "RESET_REQUEST" && job.credentialId !== null) ||
        (payload.kind === "RESET_LINK" && (payload.credentialId !== job.credentialId || payload.authorizationVersion !== job.authorizationVersion)) ||
        (payload.kind === "PASSWORD_CHANGED" && (payload.userId !== job.userId || payload.authorizationVersion !== job.authorizationVersion)))
        throw new Error("Invalid payload context");
      return payload;
    } catch {
      throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
    }
  }
  private hmac(purpose: string, value: string): string {
    return createHmac("sha256", this.env.hashPepper).update(`${purpose}:${value}`, "utf8").digest("hex");
  }
}
