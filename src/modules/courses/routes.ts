import { Router } from "express";
import { CoursesController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import { createCourseSchema, updateCourseSchema } from "./schema.js";

export const coursesRouter = Router();

// Endpoint 13: Courses GET/POST /admin/courses, PATCH/DELETE /admin/courses/:id
coursesRouter.use(requireAuth, requireRole(Role.ADMIN));

coursesRouter.get("/courses", CoursesController.list);
coursesRouter.post("/courses", validate({ body: createCourseSchema }), CoursesController.create);
coursesRouter.patch(
  "/courses/:id",
  validate({ body: updateCourseSchema }),
  CoursesController.update,
);
coursesRouter.delete("/courses/:id", CoursesController.delete);
