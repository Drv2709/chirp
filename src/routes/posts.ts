import { Router, type Response } from "express";
import { prisma } from "../lib/prisma";
import { getFeedPage } from "../lib/feed";
import { postSelect } from "../lib/postQueries";
import { idParamSchema, postContentSchema } from "../validators/post";

export const postsRouter = Router();

function renderNotFound(res: Response): void {
  res.status(404).render("pages/error", {
    title: "Not found",
    status: 404,
    message: "That post doesn't exist.",
  });
}

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

// ---------- View ----------

postsRouter.get("/posts/:id", async (req, res, next) => {
  try {
    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res);
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: id.data },
      select: postSelect,
    });

    if (!post) {
      renderNotFound(res);
      return;
    }

    res.render("pages/post", { title: `${post.author.displayName}'s post`, post });
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
      renderNotFound(res);
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: id.data },
      select: { id: true, authorId: true },
    });

    if (!post) {
      renderNotFound(res);
      return;
    }

    if (post.authorId !== user.id) {
      res.status(403).render("pages/error", {
        title: "Forbidden",
        status: 403,
        message: "You can only delete your own posts.",
      });
      return;
    }

    await prisma.post.delete({ where: { id: post.id } });
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});