import express from "express";
import type { Server } from "node:http";
import type { PluginRuntime, OpenClawPluginService, OpenClawPluginServiceContext } from "./runtime-api.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createIpWhitelistMiddleware } from "./middleware/ipWhitelist.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerSkillsRoute } from "./routes/skills.js";
import { registerMcpRoute } from "./routes/mcp.js";
import { registerAgentRoute } from "./routes/agent.js";
import { registerTaskRoute } from "./routes/task.js";
import { cleanupAllTasks } from "./services/taskManager.js";

function resolvePort(): number {
  const raw = process.env["API_GATEWAY_PORT"];
  const parsed = raw ? Number(raw) : 3099;
  if (!Number.isFinite(parsed) || parsed <= 0) { return 3099; }
  return Math.floor(parsed);
}

function resolveCorsOrigin(): string {
  return process.env["CORS_ORIGIN"] ?? "*";
}

export function createApiGatewayService(runtime: PluginRuntime): OpenClawPluginService {
  let server: Server | null = null;

  return {
    id: "api-gateway",

    async start(ctx: OpenClawPluginServiceContext) {
      const logger = ctx.logger;
      const app = express();

      app.use(express.json({ limit: "1mb" }));

      const corsOrigin = resolveCorsOrigin();
      app.use((_req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", corsOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
        next();
      });

      app.options("*", (_req, res) => {
        res.sendStatus(204);
      });

      // Health check — no auth
      const publicRouter = express.Router();
      registerHealthRoute(publicRouter);
      app.use(publicRouter);

      // Protected /api/* routes
      const apiRouter = express.Router();
      apiRouter.use(createAuthMiddleware(logger));
      apiRouter.use(createIpWhitelistMiddleware(logger));
      apiRouter.use(createRateLimiter());

      registerSkillsRoute(apiRouter, runtime, logger);
      registerMcpRoute(apiRouter, runtime, logger);
      registerAgentRoute(apiRouter, runtime, logger);
      registerTaskRoute(apiRouter);

      app.use("/api", apiRouter);

      const port = resolvePort();
      await new Promise<void>((resolve, reject) => {
        const srv = app.listen(port, () => {
          server = srv;
          resolve();
        });
        srv.once("error", reject);
      });

      logger.info(`[api-gateway] listening on port ${port}`);
    },

    async stop(ctx: OpenClawPluginServiceContext) {
      cleanupAllTasks(ctx.logger);
      await new Promise<void>((resolve) => {
        if (!server) { resolve(); return; }
        server.close(() => resolve());
        server = null;
      });
    },
  };
}
