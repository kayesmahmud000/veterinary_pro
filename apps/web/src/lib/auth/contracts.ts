import { z } from "zod";
import { normalizeInternationalPhone, normalizeSignupPhone } from "./phone";
import {
  authUserSchema,
  loginSchema,
  registerSchema,
  PUBLIC_REGISTRATION_ROLES,
  UserRole,
  type AuthUserSummary,
  type LoginRequestDto,
  type RegisterRequestDto,
} from "@vetralink/shared-types";
export type AuthMode = "login" | "register";
export type AuthField =
  "email" | "password" | "name" | "phone" | "role" | "confirmation";
export type FieldError =
  | "required"
  | "email"
  | "name"
  | "phone"
  | "password"
  | "confirmation"
  | "role";
export type FieldErrors = Partial<Record<AuthField, FieldError>>;
export const authErrorSchema = z.enum([
  "validation",
  "invalid_credentials",
  "suspended",
  "conflict_email",
  "conflict_phone",
  "conflict",
  "session_expired",
  "unavailable",
  "timeout",
  "forbidden",
  "rate_limited",
  "invalid_response",
]);
export type AuthErrorCode = z.infer<typeof authErrorSchema>;
export type AuthResult = {
  user: AuthUserSummary | null;
  code?: AuthErrorCode;
  fields?: FieldErrors;
};
export const authResultSchema = z.object({
  user: authUserSchema.nullable(),
  code: authErrorSchema.optional(),
  fields: z
    .record(
      z.enum(["required", "email", "name", "password", "confirmation", "role"]),
    )
    .optional(),
});
export const PUBLIC_ROLES = PUBLIC_REGISTRATION_ROLES;
const signupFormSchema = registerSchema
  .extend({ confirmation: z.string() })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmation)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmation"],
        message: "confirmation",
      });
  });
function errors(issues: z.ZodIssue[]): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as AuthField;
    if (
      !["email", "password", "name", "phone", "role", "confirmation"].includes(
        field,
      ) ||
      fields[field]
    )
      continue;
    fields[field] = field;
  }
  return fields;
}
export function validateCredentials(
  mode: AuthMode,
  input: unknown,
): { payload?: LoginRequestDto | RegisterRequestDto; fields: FieldErrors } {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { fields: { email: "required" } };
  const data = input as Record<string, unknown>;
  const role = data.role === undefined ? UserRole.LEARNER : data.role;
  const phone =
    mode === "register" ? normalizeInternationalPhone(data.phone) : {};
  const selected = {
    email: data.email,
    password: data.password,
    ...(mode === "register"
      ? {
          name: data.name,
          ...(phone.phone ? { phone: phone.phone } : {}),
          ...(role === UserRole.LEARNER ? {} : { role }),
        }
      : {}),
  };
  const result = (mode === "login" ? loginSchema : registerSchema).safeParse(
    selected,
  );
  const fields = {
    ...(!result.success ? errors(result.error.issues) : {}),
    ...(phone.error ? { phone: phone.error } : {}),
  };
  if (!result.success || phone.error) return { fields };
  const value = result.data as RegisterRequestDto;
  return {
    fields: {},
    payload: {
      email: value.email,
      password: value.password,
      ...(mode === "register"
        ? {
            name: value.name,
            ...(value.role ? { role: value.role } : {}),
            ...(value.phone ? { phone: value.phone } : {}),
          }
        : {}),
    } as LoginRequestDto | RegisterRequestDto,
  };
}
export function validateAuthForm(mode: AuthMode, input: unknown) {
  const data =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : undefined;
  const phone =
    mode === "register" && data
      ? normalizeSignupPhone(data.phone, data.phoneCountry)
      : {};
  const validation = validateCredentials(
    mode,
    mode === "register" && data ? { ...data, phone: phone.phone } : input,
  );
  if (mode === "register" && input && typeof input === "object") {
    const data = input as Record<string, unknown>;
    const result = signupFormSchema.safeParse({
      email: data.email,
      password: data.password,
      name: data.name,
      ...(phone.phone ? { phone: phone.phone } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      confirmation: data.confirmation,
    });
    if (!result.success)
      return {
        fields: {
          ...validation.fields,
          ...errors(result.error.issues),
          ...(phone.error ? { phone: phone.error } : {}),
        },
      };
  }
  if (phone.error)
    return { fields: { ...validation.fields, phone: phone.error } };
  return validation;
}
// Zod selects only the documented fields, including additive onboarding/version metadata.
export function readUser(input: unknown): AuthUserSummary | null {
  const result = authUserSchema.safeParse(input);
  return result.success ? result.data : null;
}
