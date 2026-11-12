import { Router } from "express";
import { prisma } from "../lib/prisma";
import { renderForbidden, renderNotFound } from "../lib/http";
import { findComments, findPostCard } from "../lib/postQueries";
import { commentContentSchema } from "../validators/comment";
import { idParamSchema } from "../validators/post";

export const commentsRouter = Router();

// ---------- Create ----------

commentsRouter.post("/posts/:id/comments", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, "That post doesn't exist.");
      return;
    }

    const post = await findPostCard(id.data, user.id);
    if (!post) {
      renderNotFound(res, "That post doesn't exist.");
      return;
    }

    const body = req.body as Record<string, unknown>;
    const parsed = commentContentSchema.safeParse(body);

    if (!parsed.success) {
      const comments = await findComments(post.id);
      res.status(400).render("pages/post", {
        title: `${post.author.displayName}'s post`,
        post,
        comments,
        error: parsed.error.issues[0]?.message ?? "Invalid comment.",
        content: typeof body.content === "string" ? body.content : "",
        currentPath: `/posts/${post.id}`,
      });
      return;
    }

    // authorId always comes from the session, postId from the validated URL param.
    await prisma.comment.create({
      data: { content: parsed.data.content, authorId: user.id, postId: post.id },
      select: { id: true },
    });

    res.redirect(`/posts/${post.id}#comments`);
  } catch (error) {
    next(error);
  }
});

// ---------- Delete (author only) ----------

commentsRouter.post("/comments/:id/delete", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) {
      renderNotFound(res, "That comment doesn't exist.");
      return;
    }

    const comment = await prisma.comment.findUnique({
      where: { id: id.data },
      select: { id: true, authorId: true, postId: true },
    });

    if (!comment) {
      renderNotFound(res, "That comment doesn't exist.");
      return;
    }

    if (comment.authorId !== user.id) {
      renderForbidden(res, "You can only delete your own comments.");
      return;
    }

    await prisma.comment.delete({ where: { id: comment.id } });
    res.redirect(`/posts/${comment.postId}#comments`);
  } catch (error) {
    next(error);
  }
});