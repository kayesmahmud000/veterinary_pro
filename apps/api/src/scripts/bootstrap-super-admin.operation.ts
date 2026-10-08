import { PrismaClient, User } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
import { BcryptPasswordHasher } from "../modules/auth/services/bcrypt-password-hasher.service";

const common = {
  reason: z.string().trim().min(10).max(500),
  confirmation: z.literal("BOOTSTRAP_FIRST_SUPER_ADMIN"),
};
const inputSchema = z.discriminatedUnion("mode", [
  z.object({
    ...common,
    mode: z.literal("promote"),
    target: z.string().uuid(),
    email: z.undefined(),
    name: z.undefined(),
    password: z.undefined(),
  }),
  z.object({
    ...common,
    mode: z.literal("create"),
    target: z.undefined(),
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(2).max(100),
    password: z.string().min(12).refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
    ),
  }),
]);
export type BootstrapInput = z.infer<typeof inputSchema>;

export function parseBootstrapInput(env: NodeJS.ProcessEnv): BootstrapInput {
  return inputSchema.parse({
    mode: env["ROLE_BOOTSTRAP_USER_ID"] === undefined ? "create" : "promote",
    target: env["ROLE_BOOTSTRAP_USER_ID"],
    email: env["ROLE_BOOTSTRAP_EMAIL"],
    name: env["ROLE_BOOTSTRAP_NAME"],
    password: env["ROLE_BOOTSTRAP_PASSWORD"],
    reason: env["ROLE_BOOTSTRAP_REASON"],
    confirmation: env["ROLE_BOOTSTRAP_CONFIRM"],
  });
}

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  input: BootstrapInput,
): Promise<void> {
  const passwordHash = input.mode === "create"
    ? await new BcryptPasswordHasher().hash(input.password)
    : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100471)::text`;
    if (await tx.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
    })) {
      throw new Error("An active super admin already exists; use protected management.");
    }
    let user: User | null;
    if (input.mode === "create") {
      if (await tx.user.findUnique({ where: { email: input.email } })) {
        throw new Error("Email already exists; use existing-account promotion.");
      }
      user = await tx.user.create({
        data: {
          id: randomUUID(),
          email: input.email,
          name: input.name,
          passwordHash: passwordHash!,
          role: "LEARNER",
          status: "ACTIVE",
        },
      });
    } else {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.target}::uuid FOR UPDATE`;
      user = await tx.user.findUnique({ where: { id: input.target } });
    }
    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      throw new Error("Target must be an existing active account.");
    }
    if (await tx.roleUpgradeRequest.count({
      where: { applicantUserId: user.id, status: "PENDING" },
    })) {
      throw new Error("Resolve the target application before bootstrap.");
    }
    const fallback = ["ADMIN", "SUPER_ADMIN"].includes(user.role)
      ? (user.previousNonAdministrativeRole ?? "LEARNER")
      : user.role;
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: "SUPER_ADMIN",
        previousNonAdministrativeRole: fallback,
        roleVersion: { increment: 1 },
        authorizationVersion: { increment: 1 },
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: null,
        action: "SUPER_ADMIN_BOOTSTRAPPED",
        entityType: "User",
        entityId: user.id,
        oldValues: { role: user.role },
        newValues: {
          role: "SUPER_ADMIN",
          reason: input.reason,
          accountCreated: input.mode === "create",
        },
        traceId: randomUUID(),
      },
    });
    await tx.roleNotificationOutbox.create({
      data: {
        eventKey: `bootstrap-${user.id}-${user.roleVersion + 1}`,
        eventType: "PRIVILEGED_ROLE_CHANGED",
        targetUserId: user.id,
        authorizationVersion: user.authorizationVersion + 1,
      },
    });
  }, { maxWait: 5000, timeout: 10000 });
}
