import { z } from "zod";
import { POST_MAX_LENGTH } from "./post";

export const commentContentSchema = z.object({
  content: z
    .string()
    .transform((value) => value.replace(/\r\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(1, "Comment can't be empty.")
        .max(POST_MAX_LENGTH, `Comments are limited to ${POST_MAX_LENGTH} characters.`),
    ),
});