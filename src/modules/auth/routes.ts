import { Router } from "express";
import { AuthController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { loginRateLimiter } from "../../middleware/rateLimit.js";
import { changePasswordSchema, loginSchema } from "./schema.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimiter, validate({ body: loginSchema }), AuthController.login);
authRouter.post("/logout", requireAuth, AuthController.logout);
authRouter.get("/me", requireAuth, AuthController.me);
authRouter.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordSchema }),
  AuthController.changePassword,
);
