/** Explicit offline first-admin setup/recovery; no HTTP endpoint or startup seed. */
import { PrismaClient } from "@prisma/client";
import { bootstrapSuperAdmin, parseBootstrapInput } from "./bootstrap-super-admin.operation";

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]?.trim()) {
    throw new Error("Set the reviewed database URL explicitly.");
  }
  const input = parseBootstrapInput(process.env);
  const prisma = new PrismaClient();
  try {
    await bootstrapSuperAdmin(prisma, input);
    console.log("First super admin created and audited. Sign in with email and password.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Validation/provider errors may contain secrets; keep operator output redacted.
  console.error("Bootstrap failed. Check operator inputs, target eligibility and existing super admins.");
  process.exitCode = 1;
});
