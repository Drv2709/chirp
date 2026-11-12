import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getFeedPage } from "../lib/feed";
import { renderForbidden, renderNotFound } from "../lib/http";
import { findComments, findPostCard } from "../lib/postQueries";
import { safeReturnTo } from "../lib/redirect";
import { idParamSchema, postContentSchema } from "../validators/post";

export const postsRouter = Router();

const POST_NOT_FOUND = "That post doesn't exist.";

// ---------- Create ----------

postsRouter.post("/posts", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const body = req.body as Record<string, unknown>;
    const parsed = postContentSchema.safeParse(body);

    if (!parsed.success) {
      const feed = await getFeedPage(user.id, 1);
      res.status(400).render("pages/home", {
        title: "Home",
        ...feed,
        error: parsed.error.issues[0]?.message ?? "Invalid post.",
        content: typeof body.content === "string" ? body.content : "",
      });
      return;
    }

    // authorId always comes from the session, never from the form.
    await prisma.post.create({
      data: { content: parsed.data.content, authorId: user.id },
      select: { id: true },
    });

    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// ---------- View (post + likes + full comment thread) ----------

postsRouter.get("/posts/:id", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    const post = await findPostCard(id.data, user.id);
    if (!post) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    const comments = await findComments(post.id);

    res.render("pages/post", {
      title: `${post.author.displayName}'s post`,
      post,
      comments,
      error: null,
      content: "",
    });
  } catch (error) {
    next(error);
  }
});

// ---------- Delete (author only) ----------

postsRouter.post("/posts/:id/delete", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: id.data },
      select: { id: true, authorId: true },
    });

    if (!post) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    if (post.authorId !== user.id) {
      renderForbidden(res, "You can only delete your own posts.");
      return;
    }

    // Likes and comments are removed by onDelete: Cascade.
    await prisma.post.delete({ where: { id: post.id } });
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// ---------- Like toggle ----------

postsRouter.post("/posts/:id/like", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: id.data },
      select: { id: true },
    });

    if (!post) {
      renderNotFound(res, POST_NOT_FOUND);
      return;
    }

    // userId always comes from the session. Delete first; if nothing was deleted, create.
    const removed = await prisma.like.deleteMany({
      where: { userId: user.id, postId: post.id },
    });

    if (removed.count === 0) {
      try {
        await prisma.like.create({
          data: { userId: user.id, postId: post.id },
          select: { id: true },
        });
      } catch (error) {
        // A double-click raced us and the unique (userId, postId) constraint caught it. Fine.
        const isDuplicate =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!isDuplicate) {
          throw error;
        }
      }
    }

    const body = req.body as Record<string, unknown>;
    res.redirect(safeReturnTo(body.returnTo, `/posts/${post.id}`));
  } catch (error) {
    next(error);
  }
});