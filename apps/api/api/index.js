// Vercel Serverless Function Entry Point for NestJS API Gateway
const path = require("path");
const fs = require("fs");

// Register global process handlers to prevent abrupt container termination
if (!global.__vetralink_handlers_registered) {
  process.on("unhandledRejection", (reason) => {
    console.error("⚠️ [Process Warning] Unhandled Rejection in Serverless Container:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("⚠️ [Process Warning] Uncaught Exception in Serverless Container:", err);
  });
  global.__vetralink_handlers_registered = true;
}

let cachedHandler = null;

function serverlessCandidates() {
  const roots = [
    path.resolve(__dirname, "../dist"),
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "apps/api/dist"),
  ];
  return [
    ...roots.flatMap((root) => [
      path.join(root, "serverless.js"),
      path.join(root, "serverless"),
    ]),
    ...roots.flatMap((root) => [
      path.join(root, "src/serverless.js"),
      path.join(root, "src/serverless"),
    ]),
  ];
}

function renderLandingHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VETRALINK PRO — API Gateway</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐾</text></svg>">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --accent: #10b981;
      --text: #f3f4f6;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at 50% 0%, #172554 0%, #090d16 65%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .container {
      max-width: 680px;
      width: 100%;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 44px 36px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.12);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
      letter-spacing: 0.3px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }
    h1 {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.6px;
      background: linear-gradient(135deg, #ffffff 30%, #93c5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }
    p.desc {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 32px;
      text-align: left;
    }
    @media (max-width: 540px) {
      .cards-grid { grid-template-columns: 1fr; }
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      padding: 14px 16px;
      border-radius: 12px;
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .card-val {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      padding: 15px 32px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.6);
    }
    .secondary-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: #cbd5e1;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.09);
      color: #ffffff;
    }
    footer {
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <div class="pulse-dot"></div>
      VetraLink Pro Gateway — Live & Operational
    </div>
    <h1>Enterprise API Platform</h1>
    <p class="desc">
      Next-generation Veterinary EHR, Livestock ERP, and Tele-Health backend service powered by NestJS and serverless cloud architecture.
    </p>

    <div class="cards-grid">
      <div class="card">
        <div class="card-title">Runtime & Host</div>
        <div class="card-val">⚡ Vercel Serverless (Node 24)</div>
      </div>
      <div class="card">
        <div class="card-title">Cloud Database</div>
        <div class="card-val">🐘 Neon PostgreSQL (3NF Schema)</div>
      </div>
      <div class="card">
        <div class="card-title">Cache & Queues</div>
        <div class="card-val">🔴 Upstash Redis + BullMQ</div>
      </div>
      <div class="card">
        <div class="card-title">API Security</div>
        <div class="card-val">🛡️ JWT RBAC + PII AES-256</div>
      </div>
    </div>

    <div class="btn-group">
      <a href="/api/docs" class="btn-primary">
        <span>📖 Explore Swagger OpenAPI Documentation</span>
        <span>→</span>
      </a>
      <div class="secondary-group">
        <a href="/api/v1/health" class="btn-secondary">
          <span>🩺 Health Check Probe</span>
        </a>
        <a href="/api/ping?diagnose=1" class="btn-secondary">
          <span>⚡ Container Diagnostics</span>
        </a>
      </div>
    </div>

    <footer>
      VETRALINK PRO © 2026 • Spec-Driven Clean Architecture • Version 1.0.0
    </footer>
  </div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const rawUrl = req.url || "";
  const matchedPath = req.headers["x-matched-path"] || "";
  const effectivePath = matchedPath || rawUrl;
  const acceptHeader = req.headers["accept"] || "";

  // 1. Direct Root Landing Page & Navigation Button
  if (
    effectivePath === "/" ||
    effectivePath === "/api" ||
    effectivePath === "/status" ||
    rawUrl === "/" ||
    rawUrl === "/api"
  ) {
    if (acceptHeader.includes("application/json") || rawUrl.includes("format=json")) {
      const jsonPayload = JSON.stringify({
        status: "online",
        service: "VETRALINK PRO — API Gateway",
        version: "1.0.0",
        message: "Project is running smoothly on Vercel Serverless!",
        documentation: "/api/docs",
        healthCheck: "/api/v1/health",
        ping: "/api/ping",
      });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(jsonPayload);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(renderLandingHtml());
  }

  // 2. Direct Redirects for /docs
  if (effectivePath === "/docs" || rawUrl === "/docs") {
    res.writeHead(302, { Location: "/api/docs" });
    return res.end();
  }

  // 3. Direct Ping & Deep Diagnostics bypass
  if (
    effectivePath === "/api/ping" ||
    effectivePath === "/ping" ||
    rawUrl.startsWith("/api/ping") ||
    rawUrl.startsWith("/ping") ||
    rawUrl.includes("ping") ||
    rawUrl.includes("diagnose")
  ) {
    const diag = {
      status: "ok",
      service: "vetralink-pro-api",
      message: "Vercel Serverless Function entry point is ACTIVE and responding!",
      timestamp: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      dirname: __dirname,
      url: rawUrl,
      matchedPath,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
        HAS_REDIS_URL: Boolean(process.env.REDIS_URL),
        HAS_JWT_ACCESS_SECRET: Boolean(process.env.JWT_ACCESS_SECRET),
        HAS_AES_KEY: Boolean(process.env.AES_PII_ENCRYPTION_KEY),
      },
    };

    if (rawUrl.includes("diagnose") || rawUrl.includes("debug")) {
      diag.diagnostics = {};
      const candidates = serverlessCandidates();
      diag.diagnostics.candidatePaths = candidates.map((c) => ({
        path: c,
        exists: fs.existsSync(c),
      }));

      try {
        diag.diagnostics.cwdFiles = fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : [];
        diag.diagnostics.dirFiles = fs.existsSync(__dirname) ? fs.readdirSync(__dirname) : [];
        const parentDir = path.resolve(__dirname, "..");
        diag.diagnostics.parentFiles = fs.existsSync(parentDir) ? fs.readdirSync(parentDir) : [];
      } catch (fsErr) {
        diag.diagnostics.fsError = fsErr.message;
      }

      try {
        const found = candidates.find((c) => fs.existsSync(c));
        if (found) {
          const mod = require(found);
          diag.diagnostics.serverlessRequireSuccess = true;
          diag.diagnostics.serverlessExportType = typeof (mod.default || mod);
        } else {
          diag.diagnostics.serverlessRequireSuccess = false;
          diag.diagnostics.serverlessError = "No candidate path exists on filesystem";
        }
      } catch (reqErr) {
        diag.diagnostics.serverlessRequireSuccess = false;
        diag.diagnostics.serverlessRequireError = {
          message: reqErr.message,
          code: reqErr.code,
          stack: reqErr.stack,
        };
      }
    }

    return res.status(200).json(diag);
  }

  // 4. Lazy module resolution with full error interception
  if (!cachedHandler) {
    try {
      const candidates = serverlessCandidates();

      let resolvedPath = null;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
          break;
        }
      }

      if (!resolvedPath) {
        return res.status(200).json({
          success: false,
          stage: "serverless_file_resolution",
          message: "Compiled serverless.js not found on filesystem",
          candidates,
          cwd: process.cwd(),
          dirname: __dirname,
        });
      }

      const imported = require(resolvedPath);
      cachedHandler = imported.default || imported;
    } catch (loadErr) {
      console.error("❌ Failed to require serverless entry module:", loadErr);
      return res.status(200).json({
        success: false,
        stage: "module_import",
        message: "Failed to require serverless entry module",
        error: loadErr?.message || String(loadErr),
        stack: loadErr?.stack,
        code: loadErr?.code,
      });
    }
  }

  // 5. Request execution through NestJS serverless handler
  try {
    if (matchedPath && typeof matchedPath === "string") {
      req.url = matchedPath;
    }
    return await cachedHandler(req, res);
  } catch (execErr) {
    console.error("❌ Vercel Serverless Handler Execution Error:", execErr);
    if (!res.headersSent) {
      return res.status(200).json({
        success: false,
        stage: "handler_execution",
        message: "Serverless Function Handler Execution Error",
        error: execErr?.message || String(execErr),
        stack: execErr?.stack,
      });
    }
  }
};
