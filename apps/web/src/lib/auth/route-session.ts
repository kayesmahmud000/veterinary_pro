import {
  authUserSchema,
  UserStatus,
  type AuthUserSummary,
} from "@vetralink/shared-types";
import { fetchWithDiagnostics } from "../api-diagnostics";

// Middleware only verifies access. Browser Web Locks own refresh/cookie rotation.
export async function getProtectedIdentity(
  access?: string,
): Promise<AuthUserSummary | null> {
  if (!access || access.length > 3800) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const base = new URL(
      `${(process.env.API_BASE_URL || "https://veterinary-api-mocha.vercel.app/api/v1").replace(/\/$/, "")}/`,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return null;
    const response = await fetchWithDiagnostics(new URL("auth/me", base), {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access}`,
      },
    });
    if (!response.ok) return null;
    const envelope: unknown = await response.json();
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !("success" in envelope) ||
      envelope.success !== true ||
      !("data" in envelope)
    )
      return null;
    const user = authUserSchema.safeParse(envelope.data);
    return user.success && user.data.status === UserStatus.ACTIVE
      ? user.data
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkProtectedAccess(access?: string): Promise<boolean> {
  return (await getProtectedIdentity(access)) !== null;
}
