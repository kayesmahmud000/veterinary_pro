import { z } from "zod";
import { ValidationDomainException } from "../exceptions/domain.exception";

export function validateWorkflow<T>(
  schema: z.ZodType<T, any, any>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ValidationDomainException(
      "Invalid workflow data.",
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.code,
      })),
    );
  return result.data;
}
