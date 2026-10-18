import { Request, Response, NextFunction } from "express";
import { AuthService } from "./service.js";
import { env } from "../../config/env.js";

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await AuthService.login(req.body);

      const isCrossSite = env.COOKIE_SECURE || env.NODE_ENV === "production";

      res.cookie("access_token", token, {
        httpOnly: true,
        secure: isCrossSite,
        sameSite: isCrossSite ? "none" : "lax",
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isCrossSite = env.COOKIE_SECURE || env.NODE_ENV === "production";

      res.clearCookie("access_token", {
        httpOnly: true,
        secure: isCrossSite,
        sameSite: isCrossSite ? "none" : "lax",
      });

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.getMe(req.user!.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.changePassword(req.user!.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
