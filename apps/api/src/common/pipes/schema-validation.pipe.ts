import { PipeTransform } from "@nestjs/common";
import { z } from "zod";
import { ValidationDomainException } from "../exceptions/domain.exception";

export class SchemaValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T, z.ZodTypeDef, any>) {}
  transform(value: unknown): T {
    if (Buffer.byteLength(JSON.stringify(value ?? {})) > 32768)
      throw new ValidationDomainException("Request is too large.");
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new ValidationDomainException(
        "Validation failed.",
        result.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    return result.data;
  }
}
