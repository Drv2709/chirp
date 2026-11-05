import { Router } from "express";
import { findPostsByAuthor } from "../lib/postQueries";

export const homeRouter = Router();

// TEMPORARY: shows your own posts. Replaced by the real feed in P4.
homeRouter.get("/", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }
    const posts = await findPostsByAuthor(user.id);
    res.render("pages/home", { title: "Home", posts, error: null, content: "" });
  } catch (error) {
    next(error);
  }
});