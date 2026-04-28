import type { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { PluginLogger } from "../runtime-api.js";

function resolveAgentTimeoutMs(): number {
  const raw = process.env["AGENT_TIMEOUT_MS"];
  const parsed = raw ? Number(raw) : 5 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5 * 60 * 1000;
  }
  return parsed;
}

export function registerMcpRoute(
  router: Router,
  runtime: PluginRuntime,
  logger: PluginLogger,
): void {
  router.post("/mcp/:serverName/:toolName", (req, res, next) => {
    (async () => {
      const { serverName, toolName } = req.params;
      const params: unknown = req.body?.params ?? {};
      const sessionKey = `api-gateway:mcp:${randomUUID()}`;

      try {
        const message = `call mcp tool: ${serverName}/${toolName} with params: ${JSON.stringify(params)}`;
        const { runId } = await runtime.subagent.run({ sessionKey, message });

        const result = await runtime.subagent.waitForRun({ runId, timeoutMs: resolveAgentTimeoutMs() });

        if (result.status === "timeout") {
          res.status(504).json({ error: "MCP tool execution timed out" });
          return;
        }
        if (result.status === "error") {
          res.status(500).json({ error: result.error ?? "MCP tool execution failed" });
          return;
        }

        const { messages } = await runtime.subagent.getSessionMessages({ sessionKey, limit: 10 });
        await runtime.subagent.deleteSession({ sessionKey });

        const lastAssistant = [...messages].toReversed().find(
          (m: unknown) => (m as Record<string, unknown>)?.role === "assistant",
        );

        res.json({ success: true, data: lastAssistant ?? { runId } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn?.(`[api-gateway] mcp ${serverName}/${toolName} failed: ${msg}`);
        res.status(500).json({ error: msg });
      }
    })().catch(next);
  });
}
