import { Request, Response, NextFunction } from "express";
import { SessionsService } from "./service.js";

export class SessionsController {
  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await SessionsService.listSessions();
      res.status(200).json(sessions);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await SessionsService.createSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await SessionsService.updateSession(req.params.id, req.body);
      res.status(200).json(session);
    } catch (error) {
      next(error);
    }
  }
}
