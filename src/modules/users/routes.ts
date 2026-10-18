import { Router } from "express";
import { UsersController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import {
  assignAdviserSchema,
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateUserSchema,
} from "./schema.js";

export const usersRouter = Router();

// All user management routes require ADMIN role
usersRouter.use(requireAuth, requireRole(Role.ADMIN));

usersRouter.get("/users", validate({ query: listUsersQuerySchema }), UsersController.list);
usersRouter.post("/users", validate({ body: createUserSchema }), UsersController.create);
usersRouter.patch("/users/:id", validate({ body: updateUserSchema }), UsersController.update);
usersRouter.post(
  "/users/:id/reset-password",
  validate({ body: resetPasswordSchema }),
  UsersController.resetPassword,
);
usersRouter.patch("/users/:id/deactivate", UsersController.deactivate);

// Assign adviser
usersRouter.post(
  "/students/:studentId/adviser",
  validate({ body: assignAdviserSchema }),
  UsersController.assignAdviser,
);
