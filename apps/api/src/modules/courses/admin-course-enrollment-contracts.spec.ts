import * as shared from "@vetralink/shared-types";
const schema = (name: string) => {
  const value = (shared as any)[name];
  expect(value).toBeDefined();
  return value;
};
const input = {
  name: "New Learner",
  email: " NEW@example.test ",
  newUserPassword: "synthetic-pass",
  actorPassword: "actor-pass",
  reason: "Requested course access",
};
describe("Administrative enrollment contracts", () => {
  it("normalizes account identity while retaining distinct credentials", () => {
    expect(schema("adminCourseUserCreateSchema").parse(input)).toEqual({
      ...input,
      email: "new@example.test",
    });
  });
  it.each(["role", "status", "isEmailVerified", "userId", "confirmation"])(
    "rejects administrative creation override %s",
    (key) => {
      expect(
        schema("adminCourseUserCreateSchema").safeParse({
          ...input,
          [key]: "forged",
        }).success,
      ).toBe(false);
    },
  );
  it.each(["short", "a".repeat(73), "ক".repeat(25)])(
    "rejects short or bcrypt-truncated passwords",
    (password) => {
      expect(
        schema("adminCourseUserCreateSchema").safeParse({
          ...input,
          newUserPassword: password,
        }).success,
      ).toBe(false);
    },
  );
  it("supports exact long email reconciliation without accepting ambiguous filters", () => {
    const q = schema("adminCourseCandidateQuerySchema");
    expect(q.parse({ email: "  EXISTING@example.test " }).email).toBe(
      "existing@example.test",
    );
    expect(
      q.safeParse({ search: "name", email: "existing@example.test" }).success,
    ).toBe(false);
    expect(q.safeParse({}).success).toBe(false);
    expect(q.safeParse({ search: "a" }).success).toBe(false);
  });
  it("rejects forged add/restore and bounds paging", () => {
    expect(
      schema("adminEnrollmentAddSchema").safeParse({
        userId: "invalid",
        reason: "short",
        actorPassword: "x",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      schema("adminCourseEnrollmentQuerySchema").safeParse({ limit: 101 })
        .success,
    ).toBe(false);
  });
});
