import path from "node:path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import passport from "passport";
import { isProduction } from "./config/env";
import { configurePassport } from "./config/passport";
import { sessionMiddleware } from "./config/session";
import { csrfProtection } from "./middleware/csrf";
import { requireAuth } from "./middleware/requireAuth";
import { authRouter, logoutRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";

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
  next();
});
app.use(csrfProtection);

// Public routes: /login and /signup only.
app.use(authRouter);

// Auth gate: everything below requires a logged-in user.
app.use(requireAuth);
app.use(logoutRouter);

// TEMPORARY home page; replaced by the real feed in P4.
app.get("/", (_req, res) => {
  res.render("pages/home", { title: "Home" });
});

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
