import { Request, Response, NextFunction } from "express";
import { ProgressService } from "./service.js";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";

export class ProgressController {
  // Student: GET /me/progress
  static async getMyProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.studentProfileId) {
        throw new UnauthorizedError("Student profile not found for authenticated user");
      }
      const progress = await ProgressService.getStudentProgress(req.user.studentProfileId);
      res.status(200).json(progress);
    } catch (error) {
      next(error);
    }
  }

  // Student: GET /me/results
  static async getMyResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.studentProfileId) {
        throw new UnauthorizedError("Student profile not found for authenticated user");
      }
      const results = await ProgressService.getStudentResults(req.user.studentProfileId);
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  }

  // Adviser: GET /adviser/students
  static async getAdviserStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      const list = await ProgressService.getAdviserStudents(req.user.id, req.query as any);
      res.status(200).json(list);
    } catch (error) {
      next(error);
    }
  }

  // Adviser: GET /adviser/students/:studentId/progress
  static async getAdviserStudentProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      const studentId = req.params.studentId;
      // Object-level authorization check: adviser can only view students assigned to them
      await ProgressService.verifyAdviserAccess(req.user.id, studentId);
      const progress = await ProgressService.getStudentProgress(studentId);
      res.status(200).json(progress);
    } catch (error) {
      next(error);
    }
  }

  // Adviser: GET /adviser/students/:studentId/results
  static async getAdviserStudentResults(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      const studentId = req.params.studentId;
      // Object-level authorization check: adviser can only view students assigned to them
      await ProgressService.verifyAdviserAccess(req.user.id, studentId);
      const results = await ProgressService.getStudentResults(studentId);
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  }

  // Admin: GET /admin/stats
  static async getAdminStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await ProgressService.getAdminStats(
        req.query.departmentId as string | undefined,
      );
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }
}
