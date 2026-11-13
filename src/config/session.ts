import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { env, isProduction } from "./env";

// DATABASE_URL may carry Prisma-only (or Neon-specific) parameters that node-postgres
// doesn't understand; strip them for the session pool.
const NON_PG_PARAMS = ["schema", "connect_timeout", "pool_timeout", "connection_limit", "channel_binding"];

function poolConnectionString(url: string): string {
  const parsed = new URL(url);
  for (const key of NON_PG_PARAMS) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

const PgStore = connectPgSimple(session);

const pool = new Pool({
  connectionString: poolConnectionString(env.DATABASE_URL),
  max: 5,
  idleTimeoutMillis: 10_000,
  // A scale-to-zero database (Neon) can take a few seconds to wake after being idle.
  connectionTimeoutMillis: 15_000,
});
pool.on("error", (error) => {
  // Idle connections get dropped when the database suspends; the pool opens new ones on demand.
  console.error("Session pool error:", error.message);
});

export const sessionMiddleware = session({
  // The "session" table is created by the Prisma migration, not by connect-pg-simple.
  store: new PgStore({ pool, tableName: "session", createTableIfMissing: false }),
  name: "chirp.sid",
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});