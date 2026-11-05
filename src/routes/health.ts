import { Router } from "express";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/healthz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});