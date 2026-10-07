import { z } from "zod";
import { authRequest, withSessionLock } from "../auth/client";
import { workspaceErrorSchema, type WorkspaceResult } from "./contracts";
export async function workspaceRequest<T>(
  path: string,
  schema: z.ZodType<T, any, any>,
  method = "GET",
  payload?: unknown,
): Promise<WorkspaceResult<T>> {
  const attempt = async (): Promise<WorkspaceResult<T>> => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 16000);
    try {
      const response = await fetch(`/api/workspace/${path}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        ...(method === "GET"
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }),
      });
      const envelope: unknown = await response.json();
      if (!response.ok) {
        const error = workspaceErrorSchema.safeParse(envelope);
        return {
          status: response.status,
          code: error.success ? error.data.code : "INVALID_RESPONSE",
          ...(error.success && error.data.fields
            ? { fields: error.data.fields }
            : {}),
        };
      }
      const result = z.object({ data: schema }).safeParse(envelope);
      return result.success
        ? { status: response.status, data: result.data.data as T }
        : { status: 502, code: "INVALID_RESPONSE" };
    } catch {
      return {
        status: 503,
        code: controller.signal.aborted ? "TIMEOUT" : "UNAVAILABLE",
      };
    } finally {
      clearTimeout(timer);
    }
  };
  return withSessionLock(async () => {
    let result = await attempt();
    if (result.status === 401) {
      const refresh = await authRequest("refresh");
      if (refresh.ok) result = await attempt();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("vetralink-session-updated"));
    }
    return result;
  });
}
