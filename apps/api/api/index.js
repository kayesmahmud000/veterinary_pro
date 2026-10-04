// Vercel Serverless Function Entry Point for NestJS API Gateway
const serverless = require("../dist/src/serverless");

module.exports = async (req, res) => {
  return serverless.default(req, res);
};
