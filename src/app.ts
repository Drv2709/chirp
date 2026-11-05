import path from "node:path";
import express from "express";
import { isProduction } from "./config/env";
import { healthRouter } from "./routes/health";

export const app = express();

// Render terminates TLS at a proxy; needed later for secure cookies.
if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(healthRouter);

// TEMPORARY: proves EJS + static CSS work. Replaced by the auth-gated feed in P2/P4.
app.get("/", (_req, res) => {
  res.render("pages/hello", { title: "Chirp" });
});
