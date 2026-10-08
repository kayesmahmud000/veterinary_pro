/** Offline recovery/bootstrap only; no HTTP endpoint. Requires an existing active account. */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
const input = z
  .object({
    target: z.string().uuid(),
    reason: z.string().trim().min(10).max(500),
    confirmation: z.literal("BOOTSTRAP_FIRST_SUPER_ADMIN"),
  })
  .parse({
    target: process.env["ROLE_BOOTSTRAP_USER_ID"],
    reason: process.env["ROLE_BOOTSTRAP_REASON"],
    confirmation: process.env["ROLE_BOOTSTRAP_CONFIRM"],
  });
if (!process.env["DATABASE_URL"])
  throw new Error("Set the reviewed database URL explicitly.");
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100471)::text`;
    if (
      await tx.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
      })
    )
      throw new Error(
        "An active super admin already exists; use the protected management workflow.",
      );
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.target}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.target } });
    if (!user || user.deletedAt || user.status !== "ACTIVE")
      throw new Error("Target must be an existing active account.");
    if (
      await tx.roleUpgradeRequest.count({
        where: { applicantUserId: user.id, status: "PENDING" },
      })
    )
      throw new Error("Resolve the target application before bootstrap.");
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
        newValues: { role: "SUPER_ADMIN", reason: input.reason },
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
  });
  console.log("First super admin created and audited. Sign in again.");
}
main()
  .catch(() => {
    console.error(
      "Bootstrap failed. Check operator inputs, target eligibility and existing super admins.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
