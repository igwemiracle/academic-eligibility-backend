import { Router } from "express";
import { ProgressController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import { adviserStudentsQuerySchema } from "./schema.js";

// Student routes (mounted at /me)
export const meRouter = Router();
meRouter.use(requireAuth, requireRole(Role.STUDENT));
meRouter.get("/progress", ProgressController.getMyProgress);
meRouter.get("/results", ProgressController.getMyResults);

// Adviser routes (mounted at /adviser)
export const adviserRouter = Router();
adviserRouter.use(requireAuth, requireRole(Role.ADVISER));
adviserRouter.get(
  "/students",
  validate({ query: adviserStudentsQuerySchema }),
  ProgressController.getAdviserStudents,
);
adviserRouter.get("/students/:studentId/progress", ProgressController.getAdviserStudentProgress);
adviserRouter.get("/students/:studentId/results", ProgressController.getAdviserStudentResults);

// Admin stats route (mounted at /admin)
export const statsRouter = Router();
statsRouter.use(requireAuth, requireRole(Role.ADMIN));
statsRouter.get("/stats", ProgressController.getAdminStats);
