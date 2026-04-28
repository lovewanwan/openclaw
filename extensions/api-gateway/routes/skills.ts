import type { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { PluginLogger } from "../runtime-api.js";

export function registerSkillsRoute(
  router: Router,
  runtime: PluginRuntime,
  logger: PluginLogger,
): void {
  router.post("/skills/:skillName", (req, res, next) => {
    (async () => {
      const { skillName } = req.params;
      const params: unknown = req.body?.params ?? {};

      const sessionKey = `api-gateway:skill:${randomUUID()}`;

      try {
        const message = `run skill: ${skillName} with params: ${JSON.stringify(params)}`;
        const { runId } = await runtime.subagent.run({ sessionKey, message });

        const timeoutMs = resolveAgentTimeoutMs();
        const result = await runtime.subagent.waitForRun({ runId, timeoutMs });

        if (result.status === "timeout") {
          res.status(504).json({ error: "Skill execution timed out" });
          return;
        }
        if (result.status === "error") {
          res.status(500).json({ error: result.error ?? "Skill execution failed" });
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
        logger.warn?.(`[api-gateway] skill ${skillName} failed: ${msg}`);
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("unknown skill")) {
          res.status(404).json({ error: `Skill not found: ${skillName}` });
          return;
        }
        res.status(500).json({ error: msg });
      }
    })().catch(next);
  });
}

function resolveAgentTimeoutMs(): number {
  const raw = process.env["AGENT_TIMEOUT_MS"];
  const parsed = raw ? Number(raw) : 5 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5 * 60 * 1000;
  }
  return parsed;
}
