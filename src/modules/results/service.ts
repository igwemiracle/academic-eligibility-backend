import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/errors.js";
import { computeGradeAndPoint } from "../../domain/eligibility/engine.js";
import { GradeScaleItem } from "../../domain/eligibility/types.js";
import { AuditService } from "../audit/service.js";
import { CreateResultInput, QueryResultInput, UpdateResultInput } from "./schema.js";

const DEFAULT_GRADE_SCALE: GradeScaleItem[] = [
  { minScore: 70, grade: "A", point: 5 },
  { minScore: 60, grade: "B", point: 4 },
  { minScore: 50, grade: "C", point: 3 },
  { minScore: 45, grade: "D", point: 2 },
  { minScore: 40, grade: "E", point: 1 },
  { minScore: 0, grade: "F", point: 0 },
];

export class ResultsService {
  private static async getDepartmentGradeScale(departmentId: string): Promise<GradeScaleItem[]> {
    const req = await prisma.graduationRequirement.findUnique({
      where: { departmentId },
    });
    if (req && Array.isArray(req.gradeScale)) {
      return req.gradeScale as unknown as GradeScaleItem[];
    }
    return DEFAULT_GRADE_SCALE;
  }

  static async listResults(query: QueryResultInput) {
    const where: any = {};
    if (query.studentId) {
      // Allow passing either studentProfile.id or userId
      const profile = await prisma.studentProfile.findFirst({
        where: {
          OR: [{ id: query.studentId }, { userId: query.studentId }],
        },
      });
      if (profile) {
        where.studentId = profile.id;
      } else {
        where.studentId = query.studentId;
      }
    }
    if (query.sessionId) {
      where.sessionId = query.sessionId;
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            units: true,
            isCompulsory: true,
            level: true,
            semester: true,
          },
        },
        session: {
          select: { id: true, name: true },
        },
        student: {
          select: {
            id: true,
            matricNumber: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: [{ session: { startYear: "desc" } }, { course: { code: "asc" } }],
    });

    return results.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      student: r.student,
      courseId: r.courseId,
      course: r.course,
      sessionId: r.sessionId,
      session: r.session,
      score: r.score,
      grade: r.grade,
      gradePoint: r.gradePoint,
      passed: r.score >= 40,
    }));
  }

  static async createResult(actorId: string, input: CreateResultInput) {
    let student = await prisma.studentProfile.findUnique({
      where: { id: input.studentId },
    });
    if (!student) {
      student = await prisma.studentProfile.findUnique({
        where: { userId: input.studentId },
      });
    }
    if (!student) {
      throw new NotFoundError("Student profile not found");
    }

    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
    });
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const session = await prisma.academicSession.findUnique({
      where: { id: input.sessionId },
    });
    if (!session) {
      throw new NotFoundError("Academic session not found");
    }

    // Check unique constraint on (studentId, courseId, sessionId)
    const existing = await prisma.result.findUnique({
      where: {
        studentId_courseId_sessionId: {
          studentId: student.id,
          courseId: course.id,
          sessionId: session.id,
        },
      },
    });
    if (existing) {
      throw new BadRequestError(
        `Result already exists for student ${student.matricNumber} in course ${course.code} for session ${session.name}`,
      );
    }

    const gradeScale = await this.getDepartmentGradeScale(course.departmentId);
    const { grade, gradePoint } = computeGradeAndPoint(input.score, gradeScale);

    const result = await prisma.result.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        sessionId: session.id,
        score: input.score,
        grade,
        gradePoint,
      },
      include: {
        course: {
          select: { code: true, title: true, units: true, isCompulsory: true },
        },
      },
    });

    await AuditService.log({
      actorId,
      action: "CREATE_RESULT",
      entity: "Result",
      entityId: result.id,
      after: result,
    });

    return {
      id: result.id,
      course: result.course,
      score: result.score,
      grade: result.grade,
      gradePoint: result.gradePoint,
      passed: result.score >= 40,
    };
  }

  static async updateResult(actorId: string, id: string, input: UpdateResultInput) {
    const existing = await prisma.result.findUnique({
      where: { id },
      include: {
        course: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Result not found");
    }

    const gradeScale = await this.getDepartmentGradeScale(existing.course.departmentId);
    const { grade, gradePoint } = computeGradeAndPoint(input.score, gradeScale);

    const updated = await prisma.result.update({
      where: { id },
      data: {
        score: input.score,
        grade,
        gradePoint,
      },
      include: {
        course: {
          select: { code: true, title: true, units: true, isCompulsory: true },
        },
      },
    });

    await AuditService.log({
      actorId,
      action: "UPDATE_RESULT",
      entity: "Result",
      entityId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      course: updated.course,
      score: updated.score,
      grade: updated.grade,
      gradePoint: updated.gradePoint,
      passed: updated.score >= 40,
    };
  }

  static async importCsv(actorId: string, fileBuffer: Buffer) {
    let records: Record<string, string>[];
    try {
      records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err: any) {
      throw new BadRequestError(`Failed to parse CSV file: ${err.message}`);
    }

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    // Pre-cache departments, courses, and sessions to minimize DB lookups
    const [courses, sessions] = await Promise.all([
      prisma.course.findMany({ select: { id: true, code: true, departmentId: true } }),
      prisma.academicSession.findMany({ select: { id: true, name: true } }),
    ]);

    const courseMap = new Map(courses.map((c) => [c.code.toUpperCase(), c]));
    const sessionMap = new Map(sessions.map((s) => [s.name.toUpperCase(), s]));

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = records[i];

      const matricNumber = row.matricNumber?.trim();
      const courseCode = row.courseCode?.trim().toUpperCase();
      const sessionName = row.session?.trim().toUpperCase();
      const scoreStr = row.score?.trim();

      if (!matricNumber || !courseCode || !sessionName || scoreStr === undefined) {
        errors.push({
          row: rowNum,
          message: "Missing required column(s): matricNumber, courseCode, session, score",
        });
        continue;
      }

      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0 || score > 100) {
        errors.push({
          row: rowNum,
          message: `Invalid score value "${scoreStr}". Must be a number between 0 and 100.`,
        });
        continue;
      }

      const student = await prisma.studentProfile.findUnique({
        where: { matricNumber },
      });
      if (!student) {
        errors.push({
          row: rowNum,
          message: `Student with matric number "${matricNumber}" not found`,
        });
        continue;
      }

      const course = courseMap.get(courseCode);
      if (!course) {
        errors.push({
          row: rowNum,
          message: `Course with code "${courseCode}" not found`,
        });
        continue;
      }

      const session = sessionMap.get(sessionName);
      if (!session) {
        errors.push({
          row: rowNum,
          message: `Academic session "${sessionName}" not found`,
        });
        continue;
      }

      // Check unique constraint
      const existing = await prisma.result.findUnique({
        where: {
          studentId_courseId_sessionId: {
            studentId: student.id,
            courseId: course.id,
            sessionId: session.id,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const gradeScale = await this.getDepartmentGradeScale(course.departmentId);
      const { grade, gradePoint } = computeGradeAndPoint(score, gradeScale);

      const created = await prisma.result.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          sessionId: session.id,
          score,
          grade,
          gradePoint,
        },
      });

      await AuditService.log({
        actorId,
        action: "IMPORT_RESULT_CSV",
        entity: "Result",
        entityId: created.id,
        after: created,
      });

      imported++;
    }

    return {
      imported,
      skipped,
      errors,
    };
  }
}
