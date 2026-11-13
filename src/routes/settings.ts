import { Router } from "express";
import { prisma } from "../lib/prisma";
import { bioFormSchema } from "../validators/profile";

export const settingsRouter = Router();

// ---------- Edit bio: form ----------

settingsRouter.get("/settings/profile", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { bio: true },
    });

    res.render("pages/settings-profile", {
      title: "Edit bio",
      bio: record?.bio ?? "",
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

// ---------- Edit bio: save ----------

settingsRouter.post("/settings/profile", async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.redirect("/login");
      return;
    }

    const body = req.body as Record<string, unknown>;
    const parsed = bioFormSchema.safeParse(body);

    if (!parsed.success) {
      res.status(400).render("pages/settings-profile", {
        title: "Edit bio",
        bio: typeof body.bio === "string" ? body.bio : "",
        error: parsed.error.issues[0]?.message ?? "Invalid bio.",
      });
      return;
    }

    // The target row always comes from the session, never from the form.
    await prisma.user.update({
      where: { id: user.id },
      data: { bio: parsed.data.bio },
      select: { id: true },
    });

    res.redirect(`/users/${user.username}`);
  } catch (error) {
    next(error);
  }
});