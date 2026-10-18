import { prisma } from "../../lib/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { AuditService } from "../audit/service.js";
import { CreateCourseInput, UpdateCourseInput } from "./schema.js";

export class CoursesService {
  static async listCourses(departmentId?: string) {
    const where = departmentId ? { departmentId } : {};
    return prisma.course.findMany({
      where,
      orderBy: [{ level: "asc" }, { semester: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        units: true,
        level: true,
        semester: true,
        isCompulsory: true,
        departmentId: true,
      },
    });
  }

  static async createCourse(actorId: string, input: CreateCourseInput) {
    let deptId = input.departmentId;
    if (!deptId) {
      const dept = await prisma.department.findFirst();
      if (!dept) {
        throw new BadRequestError("Department not found");
      }
      deptId = dept.id;
    }

    const existing = await prisma.course.findUnique({
      where: {
        departmentId_code: {
          departmentId: deptId,
          code: input.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new BadRequestError(`Course with code ${input.code} already exists in this department`);
    }

    const course = await prisma.course.create({
      data: {
        departmentId: deptId,
        code: input.code.trim().toUpperCase(),
        title: input.title.trim(),
        units: input.units,
        level: input.level,
        semester: input.semester,
        isCompulsory: input.isCompulsory,
      },
      select: {
        id: true,
        code: true,
        title: true,
        units: true,
        level: true,
        semester: true,
        isCompulsory: true,
      },
    });

    await AuditService.log({
      actorId,
      action: "CREATE_COURSE",
      entity: "Course",
      entityId: course.id,
      after: course,
    });

    return course;
  }

  static async updateCourse(actorId: string, id: string, input: UpdateCourseInput) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const updated = await prisma.course.update({
      where: { id },
      data: {
        code: input.code ? input.code.trim().toUpperCase() : undefined,
        title: input.title ? input.title.trim() : undefined,
        units: input.units,
        level: input.level,
        semester: input.semester,
        isCompulsory: input.isCompulsory,
      },
      select: {
        id: true,
        code: true,
        title: true,
        units: true,
        level: true,
        semester: true,
        isCompulsory: true,
      },
    });

    await AuditService.log({
      actorId,
      action: "UPDATE_COURSE",
      entity: "Course",
      entityId: id,
      before: course,
      after: updated,
    });

    return updated;
  }

  static async deleteCourse(actorId: string, id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { results: true } } },
    });

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    if (course._count.results > 0) {
      throw new BadRequestError(
        `Cannot delete course ${course.code} because ${course._count.results} result(s) are recorded for it`,
      );
    }

    await prisma.course.delete({ where: { id } });

    await AuditService.log({
      actorId,
      action: "DELETE_COURSE",
      entity: "Course",
      entityId: id,
      before: course,
    });

    return { message: `Course ${course.code} deleted successfully` };
  }
}
