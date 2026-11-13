import { Router, type RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getConnections, type ConnectionKind } from "../lib/connections";
import { listUsersWithFollowState } from "../lib/follows";
import { renderNotFound } from "../lib/http";
import { getProfile, getProfilePosts } from "../lib/profile";
import { safeReturnTo } from "../lib/redirect";
import { pageQuerySchema } from "../validators/pagination";
import { idParamSchema } from "../validators/post";
import { userSearchSchema } from "../validators/search";
import { usernameParamSchema } from "../validators/user";

export const usersRouter = Router();

const USER_NOT_FOUND = "That user doesn't exist.";

// ---------- Index: every user (or search results) with the correct button state ----------

usersRouter.get("/users", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const parsed = userSearchSchema.safeParse(req.query);
    const query = parsed.success ? parsed.data.q : "";

    const users = await listUsersWithFollowState(user.id, query);
    res.render("pages/users", {
      title: query ? `Search: ${query}` : "Users",
      users,
      query,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- Profile: avatar, bio, counts, follow button, their posts ----------

usersRouter.get("/users/:username", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const username = usernameParamSchema.safeParse(req.params.username);
    if (!username.success) {
      renderNotFound(res, USER_NOT_FOUND);
      return;
    }

    const profile = await getProfile(username.data, user.id);
    if (!profile) {
      renderNotFound(res, USER_NOT_FOUND);
      return;
    }

    const parsed = pageQuerySchema.safeParse(req.query);
    const page = parsed.success ? parsed.data.page : 1;

    const feed = await getProfilePosts(profile.id, user.id, page);

    // Page number past the end: go back to the first page of this profile.
    if (feed.posts.length === 0 && page > 1) {
      res.redirect(`/users/${profile.username}`);
      return;
    }

    res.render("pages/profile", {
      title: `${profile.displayName} (@${profile.username})`,
      profile,
      ...feed,
      basePath: `/users/${profile.username}`,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- Followers / Following lists (ACCEPTED follows only) ----------

function connectionsHandler(kind: ConnectionKind): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        res.redirect("/login");
        return;
      }

      const username = usernameParamSchema.safeParse(req.params.username);
      if (!username.success) {
        renderNotFound(res, USER_NOT_FOUND);
        return;
      }

      const profile = await getProfile(username.data, user.id);
      if (!profile) {
        renderNotFound(res, USER_NOT_FOUND);
        return;
      }

      const parsed = pageQuerySchema.safeParse(req.query);
      const page = parsed.success ? parsed.data.page : 1;

      const list = await getConnections(profile.id, user.id, kind, page);

      // Page number past the end: go back to the first page of this list.
      if (list.users.length === 0 && page > 1) {
        res.redirect(`/users/${profile.username}/${kind}`);
        return;
      }

      res.render("pages/connections", {
        title: `${kind === "followers" ? "Followers" : "Following"} · @${profile.username}`,
        profile,
        kind,
        ...list,
        basePath: `/users/${profile.username}/${kind}`,
      });
    } catch (error) {
      next(error);
    }
  };
}

usersRouter.get("/users/:username/followers", connectionsHandler("followers"));
usersRouter.get("/users/:username/following", connectionsHandler("following"));

// ---------- Send follow request ----------

usersRouter.post("/users/:id/follow", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, USER_NOT_FOUND);
      return;
    }

    if (id.data === user.id) {
      res.status(400).render("pages/error", {
        title: "Bad request",
        status: 400,
        message: "You can't follow yourself.",
      });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: id.data },
      select: { id: true },
    });

    if (!target) {
      renderNotFound(res, USER_NOT_FOUND);
      return;
    }

    try {
      // followerId comes from the session; status is always PENDING (schema default).
      await prisma.follow.create({
        data: { followerId: user.id, followingId: target.id },
        select: { id: true },
      });
    } catch (error) {
      // Double-click or repeat request: @@unique([followerId, followingId]) caught it. Fine.
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isDuplicate) {
        throw error;
      }
    }

    const body = req.body as Record<string, unknown>;
    res.redirect(safeReturnTo(body.returnTo, "/users"));
  } catch (error) {
    next(error);
  }
});

// ---------- Unfollow / cancel my own pending request ----------

usersRouter.post("/users/:id/unfollow", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, USER_NOT_FOUND);
      return;
    }

    // Scoped to followerId = me, so this can only ever remove my own row.
    await prisma.follow.deleteMany({
      where: { followerId: user.id, followingId: id.data },
    });

    const body = req.body as Record<string, unknown>;
    res.redirect(safeReturnTo(body.returnTo, "/users"));
  } catch (error) {
    next(error);
  }
});