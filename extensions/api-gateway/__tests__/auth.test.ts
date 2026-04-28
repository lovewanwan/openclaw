import type { Request, Response, NextFunction } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMiddleware } from "../middleware/auth.js";

describe("auth middleware", () => {
  const mockLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  };

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["API_GATEWAY_KEY"];

    mockReq = {
      headers: {},
      ip: "127.0.0.1",
      path: "/api/test",
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    delete process.env["API_GATEWAY_KEY"];
  });

  it("should pass through when no API key is configured", () => {
    const middleware = createAuthMiddleware(mockLogger);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should reject when API key is configured but header is missing", () => {
    process.env["API_GATEWAY_KEY"] = "secret123";
    const middleware = createAuthMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("auth rejected"),
    );
  });

  it("should reject when API key does not match", () => {
    process.env["API_GATEWAY_KEY"] = "secret123";
    mockReq.headers = { "x-api-key": "wrong-key" };
    const middleware = createAuthMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should pass through when API key matches", () => {
    process.env["API_GATEWAY_KEY"] = "secret123";
    mockReq.headers = { "x-api-key": "secret123" };
    const middleware = createAuthMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
