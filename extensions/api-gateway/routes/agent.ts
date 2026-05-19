import type { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { PluginLogger } from "../runtime-api.js";
import {
  createTask,
  markTaskRunning,
  markTaskDone,
  markTaskError,
} from "../services/taskManager.js";

function resolveAgentTimeoutMs(): number {
  const raw = process.env["AGENT_TIMEOUT_MS"];
  const parsed = raw ? Number(raw) : 5 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0) { return 5 * 60 * 1000; }
  return parsed;
}

function resolveTaskTtlMs(): number {
  const raw = process.env["TASK_TTL_MS"];
  const parsed = raw ? Number(raw) : 5 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0) { return 5 * 60 * 1000; }
  return parsed;
}

type TokenUsage = { inputTokens: number; outputTokens: number };

function extractTokenUsage(messages: unknown[]): TokenUsage {
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

async function runAgent(
  runtime: PluginRuntime,
  sessionKey: string,
  message: string,
  timeoutMs: number,
): Promise<{ status: "ok" | "error" | "timeout"; messages: unknown[]; error?: string; steps?: number }> {
  const { runId } = await runtime.subagent.run({ sessionKey, message });
  const result = await runtime.subagent.waitForRun({ runId, timeoutMs });
  if (result.status !== "ok") {
    return { status: result.status, messages: [], error: result.error };
  }
  const { messages } = await runtime.subagent.getSessionMessages({ sessionKey, limit: 20 });
  await runtime.subagent.deleteSession({ sessionKey });

  // Count assistant messages as steps
  const steps = messages.filter((m: unknown) => (m as Record<string, unknown>)?.role === "assistant").length;

  return { status: "ok", messages, steps };
}

export function registerAgentRoute(
  router: Router,
  runtime: PluginRuntime,
  logger: PluginLogger,
): void {
  // ===== 修改点：async handler 改为同步包装 =====
  router.post("/agent", (req, res, next) => {
    (async () => {
      const body = req.body as Record<string, unknown>;
      const goal = body?.goal;
      if (typeof goal !== "string" || !goal.trim()) {
        res.status(400).json({ error: "goal is required", code: "INVALID_REQUEST" });
        return;
      }

      const context = body?.context;
      const maxSteps = body?.maxSteps;
      const isAsync = body?.async === true;

      const messageParts = [`goal: ${goal}`];
      if (context) { messageParts.push(`context: ${JSON.stringify(context)}`); }
      if (maxSteps) { messageParts.push(`maxSteps: ${JSON.stringify(maxSteps)}`); }
      const message = messageParts.join("\n");

      if (isAsync) {
        const task = createTask();
        res.status(202).json({ taskId: task.id });

        const sessionKey = `api-gateway:agent:${task.id}`;
        const ttlMs = resolveTaskTtlMs();

        markTaskRunning(task.id);
        runAgent(runtime, sessionKey, message, resolveAgentTimeoutMs())
          .then((result) => {
            if (result.status === "ok") {
              const lastAssistant = [...result.messages].toReversed().find(
                (m: unknown) => (m as Record<string, unknown>)?.role === "assistant",
              );
              const usage = extractTokenUsage(result.messages);
              markTaskDone(task.id, { data: lastAssistant ?? { messages: result.messages }, usage }, ttlMs);
            } else {
              markTaskError(task.id, result.error ?? result.status, ttlMs);
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn?.(`[api-gateway] async agent task ${task.id} failed: ${msg}`);
            markTaskError(task.id, msg, ttlMs);
          });

        return;
      }

      const sessionKey = `api-gateway:agent:${randomUUID()}`;
      try {
        const result = await runAgent(runtime, sessionKey, message, resolveAgentTimeoutMs());

        if (result.status === "timeout") {
          res.status(504).json({ error: "Agent execution timed out", code: "TIMEOUT" });
          return;
        }
        if (result.status === "error") {
          res.status(500).json({ error: result.error ?? "Agent execution failed", code: "EXECUTION_ERROR" });
          return;
        }

        const lastAssistant = [...result.messages].toReversed().find(
          (m: unknown) => (m as Record<string, unknown>)?.role === "assistant",
        );

        const usage = extractTokenUsage(result.messages);

        res.json({
          success: true,
          data: lastAssistant ?? { messages: result.messages },
          usage
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn?.(`[api-gateway] sync agent failed: ${msg}`);
        res.status(500).json({ error: msg, code: "INTERNAL_ERROR" });
      }
    })().catch(next);
  });
}
