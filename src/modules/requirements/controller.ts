import { Request, Response, NextFunction } from "express";
import { RequirementsService } from "./service.js";

export class RequirementsController {
  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requirements = await RequirementsService.getRequirements(
        req.query.departmentId as string | undefined,
      );
      res.status(200).json(requirements);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requirements = await RequirementsService.updateRequirements(req.user!.id, req.body);
      res.status(200).json(requirements);
    } catch (error) {
      next(error);
    }
  }
}
