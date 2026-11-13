import { z } from "zod";

export const SEARCH_MAX_LENGTH = 50;

// ?q= from the URL. Missing -> "". Repeated (?q=a&q=b) fails validation and is treated as empty.
export const userSearchSchema = z.object({
  q: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH))
    .default(""),
});