import { z } from "zod";

export const POST_MAX_LENGTH = 280;

// Browsers submit textarea newlines as \r\n; normalize so the 280 limit counts each as one.
export const postContentSchema = z.object({
  content: z
    .string()
    .transform((value) => value.replace(/\r\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, "Post can't be empty.")
        .max(POST_MAX_LENGTH, `Posts are limited to ${POST_MAX_LENGTH} characters.`),
    ),
});

// cuid ids: lowercase alphanumerics. Rejects junk before it reaches the database.
export const idParamSchema = z.string().regex(/^[a-z0-9]{10,40}$/);