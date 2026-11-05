import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { env, isProduction } from "./env";

// Prisma's "?schema=public" parameter is not understood by pg; strip it.
function poolConnectionString(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

const PgStore = connectPgSimple(session);

const pool = new Pool({
  connectionString: poolConnectionString(env.DATABASE_URL),
});
pool.on("error", (error) => {
  console.error("Session pool error:", error.message);
});

export const sessionMiddleware = session({
  // The "session" table is created by the Prisma migration, not by connect-pg-simple.
  store: new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: false,
  }),
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
