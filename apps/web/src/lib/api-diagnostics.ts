// Standard HTTP reason phrases, kept portable for the Edge middleware runtime.
const STATUS_CODES: Record<number, string> = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "103": "Early Hints",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "226": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a Teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Too Early",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "451": "Unavailable For Legal Reasons",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required",
};

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
