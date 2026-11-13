import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import passport from "passport";
import { isProduction } from "./config/env";
import { configurePassport } from "./config/passport";
import { sessionMiddleware } from "./config/session";
import { countIncomingRequests } from "./lib/follows";
import { csrfProtection } from "./middleware/csrf";
import { requireAuth } from "./middleware/requireAuth";
import { authRouter, logoutRouter } from "./routes/auth";
import { commentsRouter } from "./routes/comments";
import { healthRouter } from "./routes/health";
import { homeRouter } from "./routes/home";
import { postsRouter } from "./routes/posts";
import { requestsRouter } from "./routes/requests";
import { usersRouter } from "./routes/users";

export const app = express();

// Render terminates TLS at a proxy; needed for secure cookies in production.
if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

configurePassport();

app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Public, session-free: static assets and the health check.
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(healthRouter);

// Sessions + auth
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.currentUser = req.user ?? null;
  // Where like/follow buttons send you back to. Only GET URLs are real pages; a re-rendered
  // POST response falls back to "/" unless the route overrides it.
  res.locals.currentPath = req.method === "GET" ? req.originalUrl : "/";
  next();
});
app.use(csrfProtection);

// Public routes: /login and /signup only.
app.use(authRouter);

// Auth gate: everything below requires a logged-in user.
app.use(requireAuth);

// Pending follow-request count for the nav badge.
app.use(async (req, res, next) => {
  try {
    res.locals.pendingRequestCount = req.user ? await countIncomingRequests(req.user.id) : 0;
    next();
  } catch (error) {
    next(error);
  }
});

app.use(logoutRouter);
app.use(homeRouter);
app.use(postsRouter);
app.use(commentsRouter);
app.use(usersRouter);
app.use(requestsRouter);

// Minimal 404 + error handlers (polished in P9).
app.use((_req, res) => {
  res.status(404).render("pages/error", {
    title: "Not found",
    status: 404,
    message: "That page doesn't exist.",
  });
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error(error);
  res.status(500).render("pages/error", {
    title: "Server error",
    status: 500,
    message: "Something went wrong on our end.",
  });
});