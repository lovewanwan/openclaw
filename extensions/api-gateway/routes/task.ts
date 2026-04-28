import type { Router } from "express";
import { getTask } from "../services/taskManager.js";

export function registerTaskRoute(router: Router): void {
  router.get("/task/:taskId/status", (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({ taskId: task.id, status: task.status });
  });

  router.get("/task/:taskId/result", (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (task.status === "pending" || task.status === "running") {
      res.status(202).json({ taskId: task.id, status: task.status });
      return;
    }
    if (task.status === "error") {
      res.status(500).json({ taskId: task.id, status: task.status, error: task.error });
      return;
    }
    res.json({ taskId: task.id, status: task.status, data: task.result });
  });
}
