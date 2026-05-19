import type { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { PluginLogger } from "../runtime-api.js";

function resolveAgentTimeoutMs(): number {
  const raw = process.env["AGENT_TIMEOUT_MS"];
  const parsed = raw ? Number(raw) : 5 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0) { return 5 * 60 * 1000; }
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

export function registerStreamRoute(
  router: Router,
  runtime: PluginRuntime,
  logger: PluginLogger,
): void {
  router.post("/stream/agent", (req, res, next) => {
    (async () => {
      const body = req.body as Record<string, unknown>;
      const goal = body?.goal;

      if (typeof goal !== "string" || !goal.trim()) {
        res.status(400).json({ error: "goal is required", code: "INVALID_REQUEST" });
        return;
      }

      const context = body?.context;
      const maxSteps = body?.maxSteps;

      const messageParts = [`goal: ${goal}`];
      if (context) { messageParts.push(`context: ${JSON.stringify(context)}`); }
      if (maxSteps) { messageParts.push(`maxSteps: ${JSON.stringify(maxSteps)}`); }
      const message = messageParts.join("\n");

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sessionKey = `api-gateway:stream:${randomUUID()}`;
      let isComplete = false;

      try {
        // Send initial event
        res.write(`data: ${JSON.stringify({ type: "start", sessionKey })}\n\n`);

        // Start the agent run
        const { runId } = await runtime.subagent.run({ sessionKey, message });
        res.write(`data: ${JSON.stringify({ type: "run_started", runId })}\n\n`);

        // Poll for messages periodically
        const pollInterval = 500; // 500ms
        const timeoutMs = resolveAgentTimeoutMs();
        const startTime = Date.now();
        let lastMessageCount = 0;

        const pollMessages = async (): Promise<void> => {
          if (isComplete) { return; }

          const elapsed = Date.now() - startTime;
          if (elapsed > timeoutMs) {
            res.write(`data: ${JSON.stringify({
              type: "error",
              error: "Agent execution timed out",
              code: "TIMEOUT"
            })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            isComplete = true;
            return;
          }

          try {
            const { messages } = await runtime.subagent.getSessionMessages({
              sessionKey,
              limit: 100
            });

            // Send new messages
            if (messages.length > lastMessageCount) {
              const newMessages = messages.slice(lastMessageCount);
              for (const msg of newMessages) {
                res.write(`data: ${JSON.stringify({
                  type: "message",
                  message: msg
                })}\n\n`);
              }
              lastMessageCount = messages.length;
            }

            // Check if run is complete
            const result = await runtime.subagent.waitForRun({ runId, timeoutMs: 100 });

            if (result.status === "ok") {
              const { messages: allMessages } = await runtime.subagent.getSessionMessages({
                sessionKey,
                limit: 100
              });
              const usage = extractTokenUsage(allMessages);
              res.write(`data: ${JSON.stringify({ type: "complete", usage })}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
              isComplete = true;
              await runtime.subagent.deleteSession({ sessionKey });
            } else if (result.status === "error") {
              res.write(`data: ${JSON.stringify({
                type: "error",
                error: result.error ?? "Agent execution failed",
                code: "EXECUTION_ERROR"
              })}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
              isComplete = true;
              await runtime.subagent.deleteSession({ sessionKey });
            } else {
              // Still running, continue polling
              setTimeout(pollMessages, pollInterval);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn?.(`[api-gateway] stream polling error: ${msg}`);
            res.write(`data: ${JSON.stringify({
              type: "error",
              error: msg,
              code: "INTERNAL_ERROR"
            })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            isComplete = true;
          }
        };

        // Start polling
        setTimeout(pollMessages, pollInterval);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn?.(`[api-gateway] stream agent failed: ${msg}`);
        if (!isComplete) {
          res.write(`data: ${JSON.stringify({
            type: "error",
            error: msg,
            code: "INTERNAL_ERROR"
          })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }

      // Handle client disconnect
      req.on("close", () => {
        isComplete = true;
        logger.info?.(`[api-gateway] stream client disconnected for session ${sessionKey}`);
      });

    })().catch(next);
  });
}
