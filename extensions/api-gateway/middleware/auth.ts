import type { Request, Response, NextFunction } from "express";
import type { PluginLogger } from "../runtime-api.js";

export function createAuthMiddleware(logger: PluginLogger) {
  const apiKey = process.env["API_GATEWAY_KEY"];

  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!apiKey) {
      next();
      return;
    }
    const header = req.headers["x-api-key"];
    if (!header || header !== apiKey) {
      logger.warn?.(`[api-gateway] auth rejected from ${req.ip} on ${req.path}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
