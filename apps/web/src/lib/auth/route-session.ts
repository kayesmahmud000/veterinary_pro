import { authUserSchema, UserStatus } from "@vetralink/shared-types";
import { fetchWithDiagnostics } from "../api-diagnostics";

// Middleware only verifies access. Browser Web Locks own refresh/cookie rotation.
export async function checkProtectedAccess(access?: string): Promise<boolean> {
  if (!access || access.length > 3800) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const base = new URL(
      `${(process.env.API_BASE_URL || "http://localhost:3001/api/v1").replace(/\/$/, "")}/`,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return false;
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
    if (!response.ok) return false;
    const envelope: unknown = await response.json();
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !("success" in envelope) ||
      envelope.success !== true ||
      !("data" in envelope)
    )
      return false;
    const user = authUserSchema.safeParse(envelope.data);
    return user.success && user.data.status === UserStatus.ACTIVE;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
