import { z } from "zod";

// Matches what signup allows: 3-30 chars, letters/numbers/underscores (stored lowercase).
export const usernameParamSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/);