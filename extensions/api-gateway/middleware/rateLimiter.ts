import rateLimit from "express-rate-limit";

const DEFAULT_LIMIT = 60;

function resolveMaxPerMinute(): number {
  const raw = process.env["API_GATEWAY_RATE_LIMIT"];
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.floor(parsed);
}

export function createRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: resolveMaxPerMinute(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too Many Requests" },
  });
}
