import { randomUUID } from "node:crypto";
import type { PluginLogger } from "../runtime-api.js";

export type TaskStatus = "pending" | "running" | "done" | "error";

export type TaskEntry = {
  id: string;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
  controller: AbortController;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const tasks = new Map<string, TaskEntry>();

export function createTaskId(): string {
  return randomUUID();
}

export function createTask(): TaskEntry {
  const id = createTaskId();
  const controller = new AbortController();
  const entry: TaskEntry = { id, status: "pending", createdAt: Date.now(), controller };
  tasks.set(id, entry);
  return entry;
}

export function getTask(taskId: string): TaskEntry | undefined {
  return tasks.get(taskId);
}

export function markTaskRunning(taskId: string): void {
  const task = tasks.get(taskId);
  if (task) {
    task.status = "running";
  }
}

export function markTaskDone(taskId: string, result: unknown, ttlMs: number): void {
  const task = tasks.get(taskId);
  if (!task) {
    return;
  }
  task.status = "done";
  task.result = result;
  scheduleCleanup(task, ttlMs);
}

export function markTaskError(taskId: string, error: string, ttlMs: number): void {
  const task = tasks.get(taskId);
  if (!task) {
    return;
  }
  task.status = "error";
  task.error = error;
  scheduleCleanup(task, ttlMs);
}

function scheduleCleanup(task: TaskEntry, ttlMs: number): void {
  if (task.cleanupTimer) {
    clearTimeout(task.cleanupTimer);
  }
  task.cleanupTimer = setTimeout(() => {
    tasks.delete(task.id);
  }, ttlMs);
}

export function cleanupAllTasks(logger: PluginLogger): void {
  for (const [id, task] of tasks) {
    if (task.cleanupTimer) {
      clearTimeout(task.cleanupTimer);
    }
    if (task.status === "pending" || task.status === "running") {
      task.controller.abort();
      logger.warn?.(`[api-gateway] aborted in-flight task ${id} on shutdown`);
    }
    tasks.delete(id);
  }
}
