import { z } from "zod";

export const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username must be 30 characters or fewer.")
      .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores.")
      .transform((value) => value.toLowerCase()),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(255, "Email is too long.")
      .email("Enter a valid email address."),
    displayName: z
      .string()
      .trim()
      .min(1, "Display name is required.")
      .max(50, "Display name must be 50 characters or fewer."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

// Collapses Zod issues into { fieldName: firstMessage } for the templates.
export function firstErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}