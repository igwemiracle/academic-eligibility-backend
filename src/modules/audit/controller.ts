import { Request, Response, NextFunction } from "express";
import { AuditService } from "./service.js";

export class AuditController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;
      const result = await AuditService.listLogs(page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
