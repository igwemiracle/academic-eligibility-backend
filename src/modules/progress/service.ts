import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import {
  evaluateEligibility,
  groupSemesterResults,
  roundToTwo,
} from "../../domain/eligibility/engine.js";
import {
  CourseData,
  ProgressSummary,
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

    if (students.length === 0) {
      return {
        items: [],
        page,
        pageSize,
        total: 0,
      };
    }

    // Batch evaluate progress for all students in 3 fast queries instead of N*4 queries
    const evaluations = await this.batchEvaluateStudents(students);

    const evaluatedItems = students.map((student) => {
      const summary = evaluations.get(student.id);
      return {
        studentId: student.id,
        fullName: student.user.fullName,
        matricNumber: student.matricNumber,
        level: student.level,
        cgpa: summary?.cgpa ?? 0,
        totalUnitsEarned: summary?.totalUnitsEarned ?? 0,
        status: summary?.status ?? "NOT_YET_ELIGIBLE",
      };
    });

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
      include: {
        user: true,
        department: true,
      },
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

    const evaluations = await this.batchEvaluateStudents(students);

    let eligibleCount = 0;
    let notYetEligibleCount = 0;
    let totalCgpa = 0;
    let studentsWithCarryoversCount = 0;

    for (const s of students) {
      const summary = evaluations.get(s.id);
      if (summary) {
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

  private static async batchEvaluateStudents(
    students: Array<{
      id: string;
      departmentId: string;
      matricNumber: string;
      level: number;
      entryYear: number;
      entryMode: any;
      user: { fullName: string; email: string };
      department: { name: string };
    }>,
  ): Promise<Map<string, ProgressSummary>> {
    const resultMap = new Map<string, ProgressSummary>();
    if (students.length === 0) {
      return resultMap;
    }

    const departmentIds = Array.from(new Set(students.map((s) => s.departmentId)));
    const studentIds = students.map((s) => s.id);

    // 1. Fetch requirements for all involved departments in 1 query
    const requirementsRaw = await prisma.graduationRequirement.findMany({
      where: { departmentId: { in: departmentIds } },
    });
    const requirementsMap = new Map<string, Requirements>();
    for (const req of requirementsRaw) {
      requirementsMap.set(req.departmentId, {
        departmentId: req.departmentId,
        minTotalUnits: req.minTotalUnits as { UTME: number; DIRECT_ENTRY: number },
        minCgpa: req.minCgpa,
        passMark: req.passMark,
        gradeScale: req.gradeScale as any,
        maxOutstandingCompulsory: req.maxOutstandingCompulsory,
        degreeClasses: req.degreeClasses as any,
      });
    }

    // Fallback if any department requirement missing
    for (const deptId of departmentIds) {
      if (!requirementsMap.has(deptId)) {
        const fallbackReq = await RequirementsService.getRequirements(deptId);
        requirementsMap.set(deptId, fallbackReq as unknown as Requirements);
      }
    }

    // 2. Fetch courses for all involved departments in 1 query
    const coursesRaw = await prisma.course.findMany({
      where: { departmentId: { in: departmentIds } },
    });
    const coursesByDept = new Map<string, CourseData[]>();
    for (const c of coursesRaw) {
      const list = coursesByDept.get(c.departmentId) || [];
      list.push({
        id: c.id,
        code: c.code,
        title: c.title,
        units: c.units,
        level: c.level,
        semester: c.semester,
        isCompulsory: c.isCompulsory,
      });
      coursesByDept.set(c.departmentId, list);
    }

    // 3. Fetch results for all students in 1 batch query
    const resultsRaw = await prisma.result.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        course: true,
        session: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const resultsByStudent = new Map<string, ResultData[]>();
    for (const r of resultsRaw) {
      const list = resultsByStudent.get(r.studentId) || [];
      list.push({
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
      });
      resultsByStudent.set(r.studentId, list);
    }

    // 4. In-memory evaluation (instantaneous, 0 DB round trips)
    for (const student of students) {
      const req = requirementsMap.get(student.departmentId);
      if (!req) continue;

      const deptCourses = coursesByDept.get(student.departmentId) || [];
      const studentResults = resultsByStudent.get(student.id) || [];

      const studentData: StudentData = {
        id: student.id,
        fullName: student.user.fullName,
        matricNumber: student.matricNumber,
        level: student.level,
        entryYear: student.entryYear,
        entryMode: student.entryMode,
        department: student.department.name,
      };

      const summary = evaluateEligibility({
        student: studentData,
        results: studentResults,
        courses: deptCourses,
        requirements: req,
      });

      resultMap.set(student.id, summary);
    }

    return resultMap;
  }
}
