import type { Router } from "express";

export function registerHealthRoute(router: Router): void {
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
}
