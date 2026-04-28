import type { Request, Response, NextFunction } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIpWhitelistMiddleware } from "../middleware/ipWhitelist.js";

describe("ipWhitelist middleware", () => {
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
    delete process.env["API_GATEWAY_IP_WHITELIST"];

    mockReq = {
      headers: {},
      ip: "192.168.1.100",
      path: "/api/test",
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    delete process.env["API_GATEWAY_IP_WHITELIST"];
  });

  it("should pass through when whitelist is empty", () => {
    const middleware = createIpWhitelistMiddleware(mockLogger);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should reject IP not in whitelist", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = "10.0.0.0/8, 172.16.0.0/12";
    mockReq.ip = "192.168.1.100";
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ip whitelist rejected"),
    );
  });

  it("should allow IP in CIDR range", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = "192.168.0.0/16";
    mockReq.ip = "192.168.1.100";
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should allow exact IP match", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = "192.168.1.100, 10.0.0.1";
    mockReq.ip = "192.168.1.100";
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should use x-forwarded-for header when present", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = "203.0.113.0/24";
    mockReq.ip = "192.168.1.1";
    mockReq.headers = { "x-forwarded-for": "203.0.113.50, 10.0.0.1" };
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should handle undefined req.ip gracefully", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = "192.168.0.0/16";
    mockReq.ip = undefined;
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("should trim whitespace in whitelist entries", () => {
    process.env["API_GATEWAY_IP_WHITELIST"] = " 192.168.1.100 , 10.0.0.1 ";
    mockReq.ip = "192.168.1.100";
    const middleware = createIpWhitelistMiddleware(mockLogger);

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
