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
          res.status(504).json({ error: "Skill execution timed out", code: "TIMEOUT" });
          return;
        }
        if (result.status === "error") {
          res.status(500).json({ error: result.error ?? "Skill execution failed", code: "EXECUTION_ERROR" });
          return;
        }

        const { messages } = await runtime.subagent.getSessionMessages({ sessionKey, limit: 10 });
        await runtime.subagent.deleteSession({ sessionKey });

        const lastAssistant = [...messages].toReversed().find(
          (m: unknown) => (m as Record<string, unknown>)?.role === "assistant",
        );

        const usage = extractTokenUsage(messages);

        res.json({ success: true, data: lastAssistant ?? { runId }, usage });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn?.(`[api-gateway] skill ${skillName} failed: ${msg}`);
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("unknown skill")) {
          res.status(404).json({ error: `Skill not found: ${skillName}`, code: "SKILL_NOT_FOUND" });
          return;
        }
        res.status(500).json({ error: msg, code: "INTERNAL_ERROR" });
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

function extractTokenUsage(messages: unknown[]): { inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  for (const msg of messages) {
    const m = msg as Record<string, unknown>;
    const usage = m?.usage as Record<string, unknown> | undefined;
    if (!usage) { continue; }
    const input = Number(usage.input ?? usage.inputTokens ?? 0);
    const output = Number(usage.output ?? usage.outputTokens ?? 0);
    if (Number.isFinite(input)) { inputTokens += input; }
    if (Number.isFinite(output)) { outputTokens += output; }
  }
  return { inputTokens, outputTokens };
}
