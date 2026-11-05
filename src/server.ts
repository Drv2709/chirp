import { env } from "./config/env";
import { app } from "./app";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  console.log(`Chirp listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));