import { z } from "zod";

export const updateRequirementsSchema = z
  .object({
    departmentId: z.string().optional(),
    minTotalUnits: z.object({
      UTME: z.coerce.number().int().min(1),
      DIRECT_ENTRY: z.coerce.number().int().min(1),
    }),
    minCgpa: z.coerce.number().min(0).max(5),
    passMark: z.coerce.number().min(0).max(100),
    maxOutstandingCompulsory: z.coerce.number().int().min(0),
    gradeScale: z.array(
      z.object({
        minScore: z.coerce.number().min(0).max(100),
        grade: z.string().min(1),
        point: z.coerce.number().int().min(0).max(10),
      }),
    ),
    degreeClasses: z.array(
      z.object({
        minCgpa: z.coerce.number().min(0).max(5),
        label: z.string().min(1),
      }),
    ),
  })
  .strict();

export type UpdateRequirementsInput = z.infer<typeof updateRequirementsSchema>;
