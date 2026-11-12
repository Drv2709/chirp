import type { Response } from "express";

export function renderNotFound(res: Response, message = "That page doesn't exist."): void {
  res.status(404).render("pages/error", {
    title: "Not found",
    status: 404,
    message,
  });
}

export function renderForbidden(res: Response, message: string): void {
  res.status(403).render("pages/error", {
    title: "Forbidden",
    status: 403,
    message,
  });
}