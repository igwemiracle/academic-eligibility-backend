import { z } from "zod";

export const adviserStudentsQuerySchema = z
  .object({
    status: z.enum(["ELIGIBLE", "NOT_YET_ELIGIBLE"]).optional(),
    level: z.coerce.number().int().min(100).max(500).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AdviserStudentsQuery = z.infer<typeof adviserStudentsQuerySchema>;
