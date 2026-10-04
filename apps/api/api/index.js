// Vercel Serverless Function Entry Point for NestJS API Gateway
const serverless = require("../dist/src/serverless");

module.exports = async (req, res) => {
  try {
    const matchedPath = req.headers["x-matched-path"];
    if (matchedPath && typeof matchedPath === "string") {
      req.url = matchedPath;
    }
    const handler = serverless.default || serverless;
    return await handler(req, res);
  } catch (err) {
    console.error("❌ Vercel Serverless Handler Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Serverless Function Handler Error",
        error: err?.message || String(err),
        stack: err?.stack,
      });
    }
  }
};
