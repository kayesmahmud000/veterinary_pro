import { STATUS_CODES } from "node:http";

const networkCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "ABORT_ERR",
]);
function enabled() {
  return (
    process.env.API_DEBUG === "1" ||
    (process.env.NODE_ENV !== "production" && process.env.API_DEBUG !== "0")
  );
}
function endpoint(input: URL | string) {
  const url = new URL(input);
  const path = url.pathname
    .replace(/(\/(?:drm\/)?key)\/[^/]+/gi, "$1/:redacted")
    .replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ":id");
  return `${url.origin}${path}`;
}
function errorCode(error: unknown) {
  const value = error as { name?: string; cause?: { code?: string } } | null;
  if (value?.name === "AbortError") return "ABORT_ERR";
  return value?.cause?.code && networkCodes.has(value.cause.code)
    ? value.cause.code
    : "REQUEST_FAILED";
}
function log(
  source: string,
  method: string,
  url: URL | string,
  status: number,
  started: number,
  code?: string,
  traceId?: string | null,
) {
  if (!enabled()) return;
  const record = {
    source,
    method,
    endpoint: endpoint(url),
    status,
    statusText: status === 0 ? "Network request failed" : STATUS_CODES[status],
    durationMs: Math.round(performance.now() - started),
    ...(code ? { errorCode: code } : {}),
    ...(traceId && /^[0-9a-f-]{36}$/i.test(traceId) ? { traceId } : {}),
  };
  const write =
    status === 0 || status >= 500
      ? console.error
      : status >= 400
        ? console.warn
        : console.info;
  write("[api-response]", record);
}

// Preserve fetch inputs, response streams and exceptions; log metadata only.
export async function fetchWithDiagnostics(
  input: URL,
  init?: RequestInit,
): Promise<Response> {
  const started = performance.now();
  try {
    const response = await fetch(input, init);
    log(
      "upstream",
      init?.method ?? "GET",
      input,
      response.status,
      started,
      undefined,
      response.headers.get("x-trace-id"),
    );
    return response;
  } catch (error) {
    log("upstream", init?.method ?? "GET", input, 0, started, errorCode(error));
    throw error;
  }
}
export async function withResponseDiagnostics(
  request: Request,
  run: () => Promise<Response>,
): Promise<Response> {
  const started = performance.now();
  try {
    const response = await run();
    log("web", request.method, request.url, response.status, started);
    return response;
  } catch (error) {
    log("web", request.method, request.url, 500, started, errorCode(error));
    throw error;
  }
}
