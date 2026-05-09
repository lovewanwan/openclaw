import type { Request, Response, NextFunction } from "express";
import type { PluginLogger } from "../runtime-api.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createErrorHandler(logger: PluginLogger) {
  return function errorHandler(
    err: Error | ApiError,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.code && { code: err.code }),
      });
      return;
    }

    logger.error?.(`[api-gateway] unhandled error on ${req.method} ${req.path}: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  };
}
