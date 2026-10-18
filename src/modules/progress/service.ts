import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import {
  evaluateEligibility,
  groupSemesterResults,
  roundToTwo,
} from "../../domain/eligibility/engine.js";
import {
  CourseData,
  Requirements,
  ResultData,
  StudentData,
} from "../../domain/eligibility/types.js";
import { RequirementsService } from "../requirements/service.js";
import { AdviserStudentsQuery } from "./schema.js";

export class ProgressService {
  private static async getStudentWithContext(studentProfileIdOrUserId: string) {
    let student = await prisma.studentProfile.findUnique({
      where: { id: studentProfileIdOrUserId },
      include: {
        user: true,
        department: true,
      },
    });

    if (!student) {
      student = await prisma.studentProfile.findUnique({
        where: { userId: studentProfileIdOrUserId },
        include: {
          user: true,
          department: true,
        },
      });
    }

    if (!student) {
      throw new NotFoundError("Student profile not found");
    }

    return student;
  }

  static async verifyAdviserAccess(adviserUserId: string, studentId: string) {
    const student = await this.getStudentWithContext(studentId);
    if (student.adviserId !== adviserUserId) {
      throw new ForbiddenError("You are not assigned as an adviser for this student");
    }
    return student;
  }

  static async getStudentProgress(studentId: string) {
    const student = await this.getStudentWithContext(studentId);
    const requirements = await RequirementsService.getRequirements(student.departmentId);

    const coursesRaw = await prisma.course.findMany({
      where: { departmentId: student.departmentId },
    });

    const resultsRaw = await prisma.result.findMany({
      where: { studentId: student.id },
      include: {
        course: true,
        session: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const studentData: StudentData = {
      id: student.id,
      fullName: student.user.fullName,
      matricNumber: student.matricNumber,
      level: student.level,
      entryYear: student.entryYear,
      entryMode: student.entryMode,
      department: student.department.name,
    };

    const courseData: CourseData[] = coursesRaw.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      units: c.units,
      level: c.level,
      semester: c.semester,
      isCompulsory: c.isCompulsory,
    }));

    const resultData: ResultData[] = resultsRaw.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      course: {
        id: r.course.id,
        code: r.course.code,
        title: r.course.title,
        units: r.course.units,
        level: r.course.level,
        semester: r.course.semester,
        isCompulsory: r.course.isCompulsory,
      },
      sessionId: r.sessionId,
      session: {
        id: r.session.id,
        name: r.session.name,
      },
      score: r.score,
      grade: r.grade,
      gradePoint: r.gradePoint,
      createdAt: r.createdAt,
    }));

    return evaluateEligibility({
      student: studentData,
      results: resultData,
      courses: courseData,
      requirements: requirements as unknown as Requirements,
    });
  }

  static async getStudentResults(studentId: string) {
    const student = await this.getStudentWithContext(studentId);
    const requirements = await RequirementsService.getRequirements(student.departmentId);

    const resultsRaw = await prisma.result.findMany({
      where: { studentId: student.id },
      include: {
        course: true,
        session: true,
      },
      orderBy: [{ session: { startYear: "asc" } }, { course: { semester: "asc" } }],
    });

    const resultData: ResultData[] = resultsRaw.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      course: {
        id: r.course.id,
        code: r.course.code,
        title: r.course.title,
        units: r.course.units,
        level: r.course.level,
        semester: r.course.semester,
        isCompulsory: r.course.isCompulsory,
      },
      sessionId: r.sessionId,
      session: {
        id: r.session.id,
        name: r.session.name,
      },
      score: r.score,
      grade: r.grade,
      gradePoint: r.gradePoint,
    }));

    const sessions = groupSemesterResults(resultData, requirements.passMark);
    return { sessions };
  }

  static async getAdviserStudents(adviserUserId: string, query: AdviserStudentsQuery) {
    const { status, level, search, page, pageSize } = query;

    const where: any = {
      adviserId: adviserUserId,
    };

    if (level) {
      where.level = level;
    }

    if (search) {
      where.OR = [
        { matricNumber: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: true,
        department: true,
      },
      orderBy: { matricNumber: "asc" },
    });

    // Evaluate progress for each student
    const evaluatedItems = await Promise.all(
      students.map(async (student) => {
        const summary = await this.getStudentProgress(student.id);
        return {
          studentId: student.id,
          fullName: student.user.fullName,
          matricNumber: student.matricNumber,
          level: student.level,
          cgpa: summary.cgpa,
          totalUnitsEarned: summary.totalUnitsEarned,
          status: summary.status,
        };
      }),
    );

    // Apply status filter if requested
    const filteredItems = status
      ? evaluatedItems.filter((item) => item.status === status)
      : evaluatedItems;

    const total = filteredItems.length;
    const skip = (page - 1) * pageSize;
    const paginatedItems = filteredItems.slice(skip, skip + pageSize);

    return {
      items: paginatedItems,
      page,
      pageSize,
      total,
    };
  }

  static async getAdminStats(departmentId?: string) {
    let where = {};
    if (departmentId) {
      where = { departmentId };
    }

    const students = await prisma.studentProfile.findMany({
      where,
      select: { id: true },
    });

    const totalStudents = students.length;
    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        byStatus: {
          ELIGIBLE: 0,
          NOT_YET_ELIGIBLE: 0,
        },
        averageCgpa: 0,
        studentsWithCarryovers: 0,
      };
    }

    let eligibleCount = 0;
    let notYetEligibleCount = 0;
    let totalCgpa = 0;
    let studentsWithCarryoversCount = 0;

    for (const s of students) {
      const summary = await this.getStudentProgress(s.id);
      if (summary.status === "ELIGIBLE") {
        eligibleCount++;
      } else {
        notYetEligibleCount++;
      }
      totalCgpa += summary.cgpa;
      if (summary.carryovers.length > 0) {
        studentsWithCarryoversCount++;
      }
    }

    const averageCgpa = roundToTwo(totalCgpa / totalStudents);

    return {
      totalStudents,
      byStatus: {
        ELIGIBLE: eligibleCount,
        NOT_YET_ELIGIBLE: notYetEligibleCount,
      },
      averageCgpa,
      studentsWithCarryovers: studentsWithCarryoversCount,
    };
  }
}
