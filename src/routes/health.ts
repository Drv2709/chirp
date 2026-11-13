import { Router } from "express";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

// Liveness: the process is up. No database access, so hosting health checks
// don't wake a sleeping (scale-to-zero) database.
healthRouter.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Readiness: also checks the database. Use manually, not as a hosting health check.
healthRouter.get("/healthz/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});