import { Request, Response, NextFunction } from "express";
import { UsersService } from "./service.js";

export class UsersController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UsersService.listUsers(req.query as any);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.createUser(req.body);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.updateUser(req.params.id, req.body);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UsersService.resetPassword(req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UsersService.deactivateUser(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async assignAdviser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UsersService.assignAdviser(req.params.studentId, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
