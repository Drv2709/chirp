import { Router } from "express";
import { getFeedPage } from "../lib/feed";
import { pageQuerySchema } from "../validators/pagination";

export const homeRouter = Router();

homeRouter.get("/", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const parsed = pageQuerySchema.safeParse(req.query);
    const page = parsed.success ? parsed.data.page : 1;

    const feed = await getFeedPage(user.id, page);

    // Page number past the end (e.g. after deleting posts): go back to the start.
    if (feed.posts.length === 0 && page > 1) {
      res.redirect("/");
      return;
    }

    res.render("pages/home", { title: "Home", ...feed, error: null, content: "" });
  } catch (error) {
    next(error);
  }
});