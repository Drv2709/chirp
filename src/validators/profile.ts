import { z } from "zod";

export const BIO_MAX_LENGTH = 160; // matches User.bio VarChar(160)

// Control characters (including newlines and tabs) become spaces, runs of spaces collapse,
// and the result is trimmed, so a bio is always one clean line. Empty is allowed (clears the bio).
export const bioFormSchema = z.object({
  bio: z
    .string()
    .transform((value) =>
      value
        .replace(/[\u0000-\u001F\u007F]+/g, " ")
        .replace(/ {2,}/g, " ")
        .trim(),
    )
    .pipe(z.string().max(BIO_MAX_LENGTH, `Bio is limited to ${BIO_MAX_LENGTH} characters.`)),
});