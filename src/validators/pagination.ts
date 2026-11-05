import { z } from "zod";

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
});