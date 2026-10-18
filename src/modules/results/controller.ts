import { Request, Response, NextFunction } from "express";
import { ResultsService } from "./service.js";
import { BadRequestError } from "../../lib/errors.js";

export class ResultsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await ResultsService.listResults(req.query as any);
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ResultsService.createResult(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ResultsService.updateResult(req.user!.id, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file || !req.file.buffer) {
        throw new BadRequestError("CSV file is required. Please upload using field name 'file'.");
      }

      const summary = await ResultsService.importCsv(req.user!.id, req.file.buffer);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }
}
