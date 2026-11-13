import { Router, type Request, type Response } from "express";
import type { FollowStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { listIncomingRequests } from "../lib/follows";
import { renderForbidden, renderNotFound } from "../lib/http";
import { idParamSchema } from "../validators/post";

export const requestsRouter = Router();

const REQUEST_NOT_FOUND = "That request doesn't exist.";

// ---------- Inbox ----------

requestsRouter.get("/requests", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const requests = await listIncomingRequests(user.id);
    res.render("pages/requests", { title: "Follow requests", requests });
  } catch (error) {
    next(error);
  }
});

// Loads a follow request and checks that the logged-in user is its recipient.
// Responds (404/403/redirect) and returns null if the caller should stop.
async function loadRequestForRecipient(
  req: Request,
  res: Response,
): Promise<{ id: string; status: FollowStatus } | null> {
  const user = req.user;
  if (!user) {
    res.redirect("/login");
    return null;
  }

  const id = idParamSchema.safeParse(req.params.id);
  if (!id.success) {
    renderNotFound(res, REQUEST_NOT_FOUND);
    return null;
  }

  const request = await prisma.follow.findUnique({
    where: { id: id.data },
    select: { id: true, followingId: true, status: true },
  });

  if (!request) {
    renderNotFound(res, REQUEST_NOT_FOUND);
    return null;
  }

  // Only the person being followed can respond.
  if (request.followingId !== user.id) {
    renderForbidden(res, "You can only respond to requests sent to you.");
    return null;
  }

  return { id: request.id, status: request.status };
}

// ---------- Accept: PENDING -> ACCEPTED ----------

requestsRouter.post("/requests/:id/accept", async (req, res, next) => {
  try {
    const request = await loadRequestForRecipient(req, res);
    if (!request) {
      return;
    }

    if (request.status === "PENDING") {
      await prisma.follow.update({
        where: { id: request.id },
        data: { status: "ACCEPTED" },
        select: { id: true },
      });
    }

    res.redirect("/requests");
  } catch (error) {
    next(error);
  }
});

// ---------- Reject: delete the row so the requester can ask again ----------

requestsRouter.post("/requests/:id/reject", async (req, res, next) => {
  try {
    const request = await loadRequestForRecipient(req, res);
    if (!request) {
      return;
    }

    // Only pending requests are rejectable; an ACCEPTED follow isn't touched here.
    if (request.status === "PENDING") {
      await prisma.follow.delete({ where: { id: request.id } });
    }

    res.redirect("/requests");
  } catch (error) {
    next(error);
  }
});