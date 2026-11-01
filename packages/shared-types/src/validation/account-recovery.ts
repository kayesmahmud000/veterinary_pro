import { z } from "zod";

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  locale: z.enum(["bn", "en"]).default("bn"),
}).strict();

export const passwordResetCompleteSchema = z.object({
  token: z.string().length(64).regex(/^[0-9a-f]{64}$/),
  // Match existing code-unit policy, while preventing bcrypt byte truncation.
  newPassword: z.string().min(8).max(128).refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "password_too_many_bytes",
  ),
}).strict();

export const passwordResetAcknowledgementSchema = z.object({ accepted: z.literal(true) }).strict();
export const passwordResetResultSchema = z.object({ reset: z.literal(true) }).strict();

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetCompleteInput = z.infer<typeof passwordResetCompleteSchema>;
export type PasswordResetAcknowledgement = z.infer<typeof passwordResetAcknowledgementSchema>;
export type PasswordResetResult = z.infer<typeof passwordResetResultSchema>;
