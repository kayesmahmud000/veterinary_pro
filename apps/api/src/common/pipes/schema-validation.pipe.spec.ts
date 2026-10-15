import { z } from "zod";
import { SchemaValidationPipe } from "./schema-validation.pipe";
it("keeps default requests bounded while allowing a declared curriculum body limit", () => {
  const schema = z.object({ description: z.string() }),
    input = { description: "a".repeat(40000) };
  expect(() => new SchemaValidationPipe(schema).transform(input)).toThrow();
  expect(new SchemaValidationPipe(schema, 512 * 1024).transform(input)).toEqual(
    input,
  );
  expect(() =>
    new SchemaValidationPipe(schema, 512 * 1024).transform({
      description: "a".repeat(524288),
    }),
  ).toThrow();
});
