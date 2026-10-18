import { z } from "zod";

export const createUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters").default("Password123!"),
    fullName: z.string().min(1, "Full name is required"),
    role: z.enum(["STUDENT", "ADVISER", "ADMIN"]),
    // Student specific fields
    matricNumber: z.string().optional(),
    level: z.coerce.number().int().min(100).max(400).optional(),
    entryYear: z.coerce.number().int().min(1990).max(2100).optional(),
    entryMode: z.enum(["UTME", "DIRECT_ENTRY"]).optional(),
    departmentId: z.string().optional(),
    adviserId: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.role === "STUDENT") {
        return !!data.matricNumber && !!data.level && !!data.entryYear && !!data.entryMode;
      }
      return true;
    },
    {
      message: "Student role requires matricNumber, level, entryYear, and entryMode",
      path: ["matricNumber"],
    },
  );

export const updateUserSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
    level: z.coerce.number().int().min(100).max(400).optional(),
    adviserId: z.string().nullable().optional(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  })
  .strict();

export const assignAdviserSchema = z
  .object({
    adviserId: z.string().min(1, "adviserId is required"),
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    role: z.enum(["STUDENT", "ADVISER", "ADMIN"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AssignAdviserInput = z.infer<typeof assignAdviserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
