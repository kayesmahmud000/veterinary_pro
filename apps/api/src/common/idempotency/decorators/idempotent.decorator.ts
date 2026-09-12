import { SetMetadata, CustomDecorator } from "@nestjs/common";

export interface IdempotencyOptions {
  header?: string;
  ttlSeconds?: number;
  lockTtlSeconds?: number;
  required?: boolean;
}

export const IDEMPOTENT_KEY = "IDEMPOTENT_KEY";

export const Idempotent = (
  options: IdempotencyOptions = {}
): CustomDecorator<string> => SetMetadata(IDEMPOTENT_KEY, options);
