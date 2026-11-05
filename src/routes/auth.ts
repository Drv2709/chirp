import { Router, type RequestHandler } from "express";
import passport from "passport";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { firstErrors, loginSchema, signupSchema } from "../validators/auth";

export const authRouter = Router();
export const logoutRouter = Router();

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const redirectIfAuthed: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    res.redirect("/");
    return;
  }
  next();
};

// ---------- Login ----------

authRouter.get("/login", redirectIfAuthed, (_req, res) => {
  res.render("pages/login", { title: "Log in", error: null, username: "" });
});

authRouter.post("/login", redirectIfAuthed, (req, res, next) => {
  const body = req.body as Record<string, unknown>;
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    res.status(400).render("pages/login", {
      title: "Log in",
      error: "Invalid username or password.",
      username: str(body.username),
    });
    return;
  }

  // Passport's strategy reads req.body, so hand it the normalized values.
  req.body = parsed.data;

  passport.authenticate(
    "local",
    (error: unknown, user: Express.User | false | null | undefined) => {
      if (error) {
        next(error);
        return;
      }
      if (!user) {
        res.status(401).render("pages/login", {
          title: "Log in",
          error: "Invalid username or password.",
          username: parsed.data.username,
        });
        return;
      }
      // req.logIn regenerates the session (prevents session fixation).
      req.logIn(user, (loginError) => {
        if (loginError) {
          next(loginError);
          return;
        }
        res.redirect("/");
      });
    },
  )(req, res, next);
});

// ---------- Signup ----------

authRouter.get("/signup", redirectIfAuthed, (_req, res) => {
  res.render("pages/signup", {
    title: "Sign up",
    errors: {},
    values: { username: "", email: "", displayName: "" },
  });
});

authRouter.post("/signup", redirectIfAuthed, async (req, res, next) => {
  const body = req.body as Record<string, unknown>;
  const values = {
    username: str(body.username),
    email: str(body.email),
    displayName: str(body.displayName),
  };

  try {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).render("pages/signup", {
        title: "Sign up",
        errors: firstErrors(parsed.error),
        values,
      });
      return;
    }

    const { username, email, displayName, password } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existing) {
      const errors: Record<string, string> = {};
      if (existing.username === username) errors.username = "That username is already taken.";
      if (existing.email === email) errors.email = "That email is already registered.";
      res.status(409).render("pages/signup", { title: "Sign up", errors, values });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { username, email, displayName, passwordHash },
      select: { id: true, username: true, displayName: true },
    });

    req.logIn(user, (loginError) => {
      if (loginError) {
        next(loginError);
        return;
      }
      res.redirect("/");
    });
  } catch (error) {
    // Two signups racing for the same username/email.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).render("pages/signup", {
        title: "Sign up",
        errors: { form: "That username or email is already registered." },
        values,
      });
      return;
    }
    next(error);
  }
});

// ---------- Logout (mounted behind requireAuth) ----------

logoutRouter.post("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) {
      next(error);
      return;
    }
    res.redirect("/login");
  });
});