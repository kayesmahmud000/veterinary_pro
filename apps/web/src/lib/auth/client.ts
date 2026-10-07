import type { AuthResult } from "./contracts";
import { authResultSchema } from "./contracts";

let queue: Promise<unknown> = Promise.resolve();

// Web Locks serialize rotation across tabs; the queue covers browsers without it.
export async function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks)
    return await navigator.locks.request("vetralink-auth-session", task);
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function authRequest(
  action: string,
  payload?: unknown,
): Promise<{ ok: boolean; status: number; data: AuthResult }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/auth/${action}`, {
      signal: controller.signal,
      method: action === "session" ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      ...(action !== "session"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload ?? {}),
          }
        : {}),
    });
    const parsed = authResultSchema.safeParse(await response.json());
    if (!parsed.success)
      return {
        ok: false,
        status: 502,
        data: { user: null, code: "invalid_response" },
      };
    return {
      ok: response.ok,
      status: response.status,
      data: parsed.data as AuthResult,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: {
        user: null,
        code: controller.signal.aborted ? "timeout" : "unavailable",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
