import { Request, Response, NextFunction } from "express";
import { CoursesService } from "./service.js";

export class CoursesController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courses = await CoursesService.listCourses(
        req.query.departmentId as string | undefined,
      );
      res.status(200).json(courses);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await CoursesService.createCourse(req.user!.id, req.body);
      res.status(201).json(course);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const course = await CoursesService.updateCourse(req.user!.id, req.params.id, req.body);
      res.status(200).json(course);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CoursesService.deleteCourse(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
