import * as contracts from "@vetralink/shared-types";
import { z } from "zod";

// Namespace access allows the initial RED run to report missing contracts.
const exported = contracts as unknown as Record<string, z.ZodTypeAny>;
const schema = (name: string): z.ZodTypeAny => {
  expect(exported[name]).toBeDefined();
  return exported[name];
};

describe("account recovery shared contracts", () => {
  it("normalizes email and defaults only a missing locale to Bangla", () => {
    const request = schema("passwordResetRequestSchema");
    expect(request.parse({ email: "  PERSON@Example.test  " })).toEqual({
      email: "person@example.test", locale: "bn",
    });
    expect(request.parse({ email: "person@example.test", locale: "en" }).locale).toBe("en");
    for (const value of [null, [], {}, { email: "bad" },
      { email: "a@example.test", locale: null },
      { email: "a@example.test", locale: "fr" },
      { email: "a@example.test", callbackUrl: "https://example.test" },
      { email: `${"a".repeat(243)}@example.test` }]) {
      expect(request.safeParse(value).success).toBe(false);
    }
  });

  it("requires exactly lowercase 32-byte hexadecimal credentials", () => {
    const complete = schema("passwordResetCompleteSchema");
    for (const token of ["a".repeat(63), "a".repeat(65), "A".repeat(64),
      "z".repeat(64), ` ${"a".repeat(64)}`, "a".repeat(64) + "\n", null]) {
      expect(complete.safeParse({ token, newPassword: "password123" }).success).toBe(false);
    }
    expect(complete.safeParse({ token: "a".repeat(64), newPassword: "password123", confirmPassword: "password123" }).success).toBe(false);
  });

  it("preserves passwords and enforces code-unit and UTF-8 byte boundaries", () => {
    const complete = schema("passwordResetCompleteSchema");
    for (const password of ["12345678", "a".repeat(72), "ক".repeat(24), "😀".repeat(18), "  spaced  ", "e\u0301".repeat(8)]) {
      expect(complete.parse({ token: "a".repeat(64), newPassword: password }).newPassword).toBe(password);
    }
    for (const newPassword of ["a".repeat(7), "a".repeat(73), "a".repeat(129), "ক".repeat(25), "😀".repeat(19), null]) {
      expect(complete.safeParse({ token: "a".repeat(64), newPassword }).success).toBe(false);
    }
  });

  it("accepts only exact affirmative result shapes without user or session data", () => {
    for (const [name, key] of [["passwordResetAcknowledgementSchema", "accepted"], ["passwordResetResultSchema", "reset"]]) {
      const result = schema(name);
      expect(result.parse({ [key]: true })).toEqual({ [key]: true });
      for (const value of [{}, { [key]: false }, { [key]: true, accessToken: "secret" }, null, []])
        expect(result.safeParse(value).success).toBe(false);
    }
  });
});
