import { Router } from "express";
import { SessionsController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import { createSessionSchema, updateSessionSchema } from "./schema.js";

export const sessionsRouter = Router();

// Endpoint 14: Sessions GET/POST /admin/sessions, PATCH /admin/sessions/:id
sessionsRouter.use(requireAuth, requireRole(Role.ADMIN));

sessionsRouter.get("/sessions", SessionsController.list);
sessionsRouter.post(
  "/sessions",
  validate({ body: createSessionSchema }),
  SessionsController.create,
);
sessionsRouter.patch(
  "/sessions/:id",
  validate({ body: updateSessionSchema }),
  SessionsController.update,
);
