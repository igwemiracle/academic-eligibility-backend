import { z } from "zod";

export const createResultSchema = z
  .object({
    studentId: z.string().min(1, "studentId is required"),
    courseId: z.string().min(1, "courseId is required"),
    sessionId: z.string().min(1, "sessionId is required"),
    score: z.coerce
      .number()
      .min(0, "Score cannot be less than 0")
      .max(100, "Score cannot be greater than 100"),
  })
  .strict();

export const updateResultSchema = z
  .object({
    score: z.coerce
      .number()
      .min(0, "Score cannot be less than 0")
      .max(100, "Score cannot be greater than 100"),
  })
  .strict();

export const queryResultSchema = z
  .object({
    studentId: z.string().optional(),
    sessionId: z.string().optional(),
  })
  .strict();

export type CreateResultInput = z.infer<typeof createResultSchema>;
export type UpdateResultInput = z.infer<typeof updateResultSchema>;
export type QueryResultInput = z.infer<typeof queryResultSchema>;
