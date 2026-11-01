import { PipeTransform } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Allow } from "class-validator";
import { z } from "zod";
import { ForgotPasswordRequestDto, ResetPasswordRequestDto } from "@vetralink/shared-types";
import { AccountRecoveryException } from "./account-recovery.errors";

// Nest's whitelist handles declared fields; the pipe owns all runtime policy,
// including code-unit lengths (class-validator counts Unicode points instead).
export class PasswordResetRequestDto implements ForgotPasswordRequestDto {
  @ApiProperty({ maxLength: 254 })
  @Allow()
  readonly email!: string;

  @ApiPropertyOptional({ enum: ["bn", "en"], default: "bn" })
  @Allow()
  readonly locale!: "bn" | "en";
}

export class PasswordResetCompleteDto implements ResetPasswordRequestDto {
  @ApiProperty({ minLength: 64, maxLength: 64, pattern: "^[0-9a-f]{64}$", writeOnly: true })
  @Allow()
  readonly token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true, description: "At most 72 UTF-8 bytes; preserved without normalization." })
  @Allow()
  readonly newPassword!: string;
}

export class RecoveryValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issues = result.error.issues;
    if (issues.some((issue) => issue.path[0] === "token") &&
      !issues.some((issue) => issue.path[0] === "newPassword" || issue.code === "unrecognized_keys"))
      throw new AccountRecoveryException("RESET_LINK_INVALID");
    const allowed = ["email", "locale", "newPassword"] as const;
    const fields = allowed.filter((field) => issues.some((issue) => issue.path[0] === field));
    throw new AccountRecoveryException("VALIDATION_FAILED", fields);
  }
}
