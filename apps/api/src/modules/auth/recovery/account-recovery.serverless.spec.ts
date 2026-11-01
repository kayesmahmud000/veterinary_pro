import { NestFactory } from "@nestjs/core";
import { Request, Response } from "express";

// Exercise bootstrap failure without loading/connecting the real application.
jest.mock("../../../app.module", () => ({ AppModule: class AppModule {} }));
import handler from "../../../serverless";

describe("recovery serverless bootstrap errors", () => {
  it("rejects original queries before matched-path rewriting or bootstrap", async () => {
    const factory = jest.spyOn(NestFactory, "create").mockRejectedValueOnce(new Error("not reached"));
    const response = {
      headersSent: false, locals: {}, setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(), json: jest.fn(),
    };
    try {
      await handler({ url: "/api?token=query-secret", headers: {
        "x-matched-path": "/api/v1/auth/password-reset/complete",
      } } as unknown as Request, response as unknown as Response);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(factory).not.toHaveBeenCalled();
      expect(JSON.stringify(response.json.mock.calls)).not.toContain("query-secret");
    } finally {
      factory.mockRestore();
    }
  });

  it("returns safe 503 without logging or reflecting the bootstrap exception", async () => {
    const factory = jest.spyOn(NestFactory, "create").mockRejectedValueOnce(new Error("synthetic-bootstrap-secret"));
    const logger = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const response = {
      headersSent: false, locals: {}, setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(), json: jest.fn(),
    };
    try {
      await handler({ url: "/api/v1/auth/password-reset/complete", headers: {} } as Request, response as unknown as Response);
      expect(response.status).toHaveBeenCalledWith(503);
      expect(JSON.stringify(response.json.mock.calls)).not.toContain("synthetic-bootstrap-secret");
      expect(JSON.stringify(logger.mock.calls)).not.toContain("synthetic-bootstrap-secret");
      expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    } finally {
      factory.mockRestore();
      logger.mockRestore();
    }
  });
});
