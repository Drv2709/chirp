import crypto from "node:crypto";
import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Session-bound CSRF token. Every state-changing form must include:
//   <input type="hidden" name="_csrf" value="<%= csrfToken %>">
export const csrfProtection: RequestHandler = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  const expected = req.session.csrfToken;
  res.locals.csrfToken = expected;

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const submitted = typeof body?._csrf === "string" ? body._csrf : "";
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);

  const valid =
    submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer);

  if (!valid) {
    res.status(403).render("pages/error", {
      title: "Forbidden",
      status: 403,
      message: "Your security token is missing or expired. Go back, refresh the page, and try again.",
    });
    return;
  }

  next();
};