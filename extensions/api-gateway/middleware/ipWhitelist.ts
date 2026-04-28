import type { Request, Response, NextFunction } from "express";
import ipRangeCheck from "ip-range-check";
import type { PluginLogger } from "../runtime-api.js";

function parseWhitelist(): string[] {
  const raw = process.env["API_GATEWAY_IP_WHITELIST"]?.trim();
  if (!raw) { return []; }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? req.ip ?? "";
  }
  return req.ip ?? "";
}

export function createIpWhitelistMiddleware(logger: PluginLogger) {
  const ranges = parseWhitelist();

  return function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (ranges.length === 0) {
      next();
      return;
    }

    const ip = resolveRequestIp(req);
    if (!ipRangeCheck(ip, ranges)) {
      logger.warn?.(`[api-gateway] ip whitelist rejected ${ip} on ${req.path}`);
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
