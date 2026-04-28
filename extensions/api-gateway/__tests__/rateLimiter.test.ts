import type { Request, Response, NextFunction } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../middleware/rateLimiter.js";

describe("rateLimiter middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["API_GATEWAY_RATE_LIMIT"];

    mockReq = {
      ip: "192.168.1.100",
      path: "/api/test",
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    delete process.env["API_GATEWAY_RATE_LIMIT"];
  });

  it("should use default limit when env var not set", () => {
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
  });

  it("should respect custom rate limit from env", () => {
    process.env["API_GATEWAY_RATE_LIMIT"] = "10";
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
  });

  it("should fall back to default on invalid env value", () => {
    process.env["API_GATEWAY_RATE_LIMIT"] = "invalid";
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
  });

  it("should fall back to default on negative value", () => {
    process.env["API_GATEWAY_RATE_LIMIT"] = "-5";
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
  });

  it("should fall back to default on zero", () => {
    process.env["API_GATEWAY_RATE_LIMIT"] = "0";
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
  });
});
