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

module.exports = async (req, res) => {
  const rawUrl = req.url || "";
  const matchedPath = req.headers["x-matched-path"] || "";
  const effectivePath = matchedPath || rawUrl;

  // 1. Direct Ping / Health Bypass (zero dependency, returns 200 OK immediately)
  if (
    effectivePath === "/api/ping" ||
    effectivePath === "/ping" ||
    rawUrl === "/api/ping" ||
    rawUrl === "/ping" ||
    rawUrl.includes("ping=true")
  ) {
    return res.status(200).json({
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
    });
  }

  // 2. Lazy module resolution with full error interception
  if (!cachedHandler) {
    try {
      const candidates = [
        path.resolve(__dirname, "../dist/src/serverless.js"),
        path.resolve(__dirname, "../dist/src/serverless"),
        path.resolve(process.cwd(), "dist/src/serverless.js"),
        path.resolve(process.cwd(), "dist/src/serverless"),
        path.resolve(process.cwd(), "apps/api/dist/src/serverless.js"),
      ];

      let resolvedPath = null;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
          break;
        }
      }

      if (!resolvedPath) {
        const rootFiles = fs.existsSync(process.cwd())
          ? fs.readdirSync(process.cwd())
          : [];
        const dirFiles = fs.existsSync(__dirname)
          ? fs.readdirSync(__dirname)
          : [];
        const parentDir = path.resolve(__dirname, "..");
        const parentFiles = fs.existsSync(parentDir)
          ? fs.readdirSync(parentDir)
          : [];

        console.error("❌ serverless.js not found in candidate paths:", candidates);
        return res.status(500).json({
          success: false,
          stage: "serverless_file_resolution",
          message: "Compiled serverless.js not found on filesystem",
          candidates,
          cwd: process.cwd(),
          dirname: __dirname,
          rootFiles,
          dirFiles,
          parentFiles,
        });
      }

      const imported = require(resolvedPath);
      cachedHandler = imported.default || imported;
    } catch (loadErr) {
      console.error("❌ Failed to require serverless entry module:", loadErr);
      return res.status(500).json({
        success: false,
        stage: "module_import",
        message: "Failed to require serverless entry module",
        error: loadErr?.message || String(loadErr),
        stack: loadErr?.stack,
        code: loadErr?.code,
      });
    }
  }

  // 3. Request execution through NestJS serverless handler
  try {
    if (matchedPath && typeof matchedPath === "string") {
      req.url = matchedPath;
    }
    return await cachedHandler(req, res);
  } catch (execErr) {
    console.error("❌ Vercel Serverless Handler Execution Error:", execErr);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        stage: "handler_execution",
        message: "Serverless Function Handler Execution Error",
        error: execErr?.message || String(execErr),
        stack: execErr?.stack,
      });
    }
  }
};
