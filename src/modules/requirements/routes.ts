import { Router } from "express";
import { RequirementsController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import { updateRequirementsSchema } from "./schema.js";

export const requirementsRouter = Router();

// Endpoint 16: Requirements GET /admin/requirements and PUT /admin/requirements
requirementsRouter.use(requireAuth, requireRole(Role.ADMIN));

requirementsRouter.get("/requirements", RequirementsController.get);
requirementsRouter.put(
  "/requirements",
  validate({ body: updateRequirementsSchema }),
  RequirementsController.update,
);
