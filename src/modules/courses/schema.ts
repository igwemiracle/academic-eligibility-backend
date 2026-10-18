import { z } from "zod";

export const createCourseSchema = z
  .object({
    code: z.string().min(1, "Course code is required"),
    title: z.string().min(1, "Course title is required"),
    units: z.coerce.number().int().min(1).max(10),
    level: z.coerce.number().int().min(100).max(500),
    semester: z.coerce.number().int().min(1).max(2),
    isCompulsory: z.boolean(),
    departmentId: z.string().optional(),
  })
  .strict();

export const updateCourseSchema = z
  .object({
    code: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    units: z.coerce.number().int().min(1).max(10).optional(),
    level: z.coerce.number().int().min(100).max(500).optional(),
    semester: z.coerce.number().int().min(1).max(2).optional(),
    isCompulsory: z.boolean().optional(),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
