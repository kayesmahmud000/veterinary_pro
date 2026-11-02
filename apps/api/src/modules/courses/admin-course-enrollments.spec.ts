import { AdminCourseEnrollmentsService } from "./admin-course-enrollments.service";
import { UserEntity } from "../users/entities/user.entity";
import { UserRole, UserStatus } from "@vetralink/shared-types";
const id = "11111111-1111-4111-8111-111111111111",
  target = "22222222-2222-4222-8222-222222222222";
const actor = () =>
  UserEntity.create({
    id,
    name: "Admin",
    email: "admin@example.test",
    passwordHash: "actor-hash",
    role: UserRole.ADMIN,
  });
const claims: any = { sub: id, role: UserRole.ADMIN, authorizationVersion: 0 };
const create = {
  name: "New Learner",
  email: "new@example.test",
  newUserPassword: "synthetic-new-pass",
  actorPassword: "synthetic-actor-pass",
  reason: "Requested new course access",
};
function fixture() {
  const saved: any[] = [];
  const users: any = {
    findById: async () => actor(),
    lockById: async () => actor(),
    findByEmail: async () => null,
    create: async (u: any) => {
      saved.push(u);
      return u;
    },
  };
  const repo: any = {
    project: (r: any) => ({
      id: r.id,
      user: { id: r.userId },
      status: r.status,
    }),
  };
  const writer: any = {
    lock: async (productId: string, userId: string) => ({
      product: {},
      membership: null,
      userId,
      productId,
    }),
    activateLocked: async (c: any) => ({
      changed: true,
      enrollment: { id: target, userId: c.userId, status: "ACTIVE" },
    }),
  };
  const audit: any = { record: async () => undefined };
  const service = new AdminCourseEnrollmentsService(
    repo,
    writer,
    users,
    { hash: async () => "new-password-hash", compare: async () => true } as any,
    { run: async (fn: any) => fn({}) } as any,
    audit,
    { hit: async () => undefined } as any,
    { adminCourseEnrollmentsEnabled: true, redisEnabled: true } as any,
  );
  return { service, users, repo, writer, audit, saved };
}
describe("Administrative course membership and account policy", () => {
  it("creates a fixed ordinary identity with no returned password or session", async () => {
    const f = fixture();
    const result = await f.service.createUserAndEnroll(claims, id, create);
    expect(f.saved[0]).toMatchObject({
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      isEmailVerified: false,
      passwordHash: "new-password-hash",
    });
    expect(result.accountCreated).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/synthetic|password|token/i);
  });
  it("never overwrites an existing account", async () => {
    const f = fixture();
    f.users.findByEmail = async () => actor();
    await expect(
      f.service.createUserAndEnroll(claims, id, create),
    ).rejects.toMatchObject({ errorCode: "ACCOUNT_EXISTS" });
    expect(f.saved).toHaveLength(0);
  });
  it("denies actors whose current database role was demoted", async () => {
    const f = fixture();
    f.users.findById = async () =>
      UserEntity.create({
        id,
        name: "User",
        email: "user@example.test",
        passwordHash: "hash",
      });
    await expect(
      f.service.createUserAndEnroll(claims, id, create),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(f.saved).toHaveLength(0);
  });
  it("rechecks actor authorization after password hashing", async () => {
    const f = fixture();
    f.users.lockById = async () =>
      UserEntity.reconstitute({
        ...actor().toSafeObject(),
        passwordHash: "actor-hash",
        authorizationVersion: 1,
      } as any);
    await expect(
      f.service.createUserAndEnroll(claims, id, create),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(f.saved).toHaveLength(0);
  });
});
