"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
export function useCourseData<T>(
  path: string | null,
  schema: z.ZodType<T, any, any>,
) {
  const [state, setState] = useState<{
      path: string | null;
      data?: T;
      code?: string;
    }>({ path: null }),
    [revision, reload] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setState({ path: null });
      return;
    }
    let active = true;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 14000);
    setLoading(true);
    setState({ path });
    void fetch(`/api/courses${path}`, {
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.code ?? "UNAVAILABLE");
        const parsed = schema.safeParse(body.data);
        if (!parsed.success) throw new Error("INVALID_RESPONSE");
        if (active) setState({ path, data: parsed.data });
      })
      .catch((error) => {
        if (active)
          setState({
            path,
            code: error instanceof Error ? error.message : "UNAVAILABLE",
          });
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, schema, revision]);
  return {
    data: state.path === path ? state.data : undefined,
    code: state.path === path ? state.code : undefined,
    loading: !!path && (state.path !== path || loading),
    reload: () => reload((v) => v + 1),
  };
}
