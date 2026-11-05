import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// Single shared client. In dev, tsx watch reloads modules, so cache on globalThis
// to avoid opening a new connection pool on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}