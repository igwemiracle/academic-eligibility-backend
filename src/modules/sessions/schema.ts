import { z } from "zod";

export const createSessionSchema = z
  .object({
    name: z
      .string()
      .regex(/^\d{4}\/\d{4}$/, "Session name must follow format 'YYYY/YYYY' (e.g. 2023/2024)"),
    startYear: z.coerce.number().int().min(1990).max(2100),
    endYear: z.coerce.number().int().min(1990).max(2100),
  })
  .strict();

export const updateSessionSchema = z
  .object({
    name: z
      .string()
      .regex(/^\d{4}\/\d{4}$/, "Session name must follow format 'YYYY/YYYY'")
      .optional(),
    startYear: z.coerce.number().int().min(1990).max(2100).optional(),
    endYear: z.coerce.number().int().min(1990).max(2100).optional(),
  })
  .strict();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
