import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Courses, Sessions, Results & CSV Import API", () => {
  const password = "Password123!";
  const passwordHash = bcrypt.hashSync(password, 10);

  const adminUser = {
    id: "user-admin-1",
    email: "admin2@example.com",
    fullName: "Admin Two",
    passwordHash,
    role: "ADMIN" as const,
    isActive: true,
    studentProfile: null,
  };

  const mockDept = {
    id: "dept-cs",
    name: "Computer Science",
    code: "CSC",
  };

  const mockCourse = {
    id: "course-211",
    code: "CMP 211",
    title: "Computer Programming I",
    units: 3,
    level: 200,
    semester: 1,
    isCompulsory: true,
    departmentId: "dept-cs",
  };

  const mockSession = {
    id: "session-2023",
    name: "2023/2024",
    startYear: 2023,
    endYear: 2024,
  };

  const mockStudent = {
    id: "student-profile-1",
    userId: "user-student-1",
    departmentId: "dept-cs",
    matricNumber: "CSC/2021/999",
    level: 200,
    entryYear: 2021,
    entryMode: "UTME" as const,
    adviserId: null,
  };

  const defaultDeptReq = {
    departmentId: "dept-cs",
    minTotalUnits: { UTME: 166, DIRECT_ENTRY: 121 },
    minCgpa: 1.0,
    passMark: 40,
    maxOutstandingCompulsory: 0,
    gradeScale: [
      { minScore: 70, grade: "A", point: 5 },
      { minScore: 60, grade: "B", point: 4 },
      { minScore: 50, grade: "C", point: 3 },
      { minScore: 45, grade: "D", point: 2 },
      { minScore: 40, grade: "E", point: 1 },
      { minScore: 0, grade: "F", point: 0 },
    ],
    degreeClasses: [
      { minCgpa: 4.5, label: "First Class" },
      { minCgpa: 3.5, label: "Second Class Upper" },
      { minCgpa: 2.4, label: "Second Class Lower" },
      { minCgpa: 1.5, label: "Third Class" },
      { minCgpa: 1.0, label: "Pass" },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function getAdminCookie() {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: adminUser.email, password });
    return res.headers["set-cookie"];
  }

  describe("Courses API", () => {
    it("POST /api/v1/admin/courses creates a course and logs audit", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.course, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.course, "create").mockResolvedValue(mockCourse as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

      const res = await request(app).post("/api/v1/admin/courses").set("Cookie", cookie).send({
        code: "CMP 211",
        title: "Computer Programming I",
        units: 3,
        level: 200,
        semester: 1,
        isCompulsory: true,
        departmentId: "dept-cs",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        code: "CMP 211",
        title: "Computer Programming I",
        units: 3,
        level: 200,
        semester: 1,
        isCompulsory: true,
      });
    });

    it("POST /api/v1/admin/courses rejects duplicate course code in same department", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.course, "findUnique").mockResolvedValue(mockCourse as any);

      const res = await request(app).post("/api/v1/admin/courses").set("Cookie", cookie).send({
        code: "CMP 211",
        title: "Duplicate Course",
        units: 3,
        level: 200,
        semester: 1,
        isCompulsory: true,
        departmentId: "dept-cs",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("already exists");
    });

    it("GET /api/v1/admin/courses returns list of courses", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.course, "findMany").mockResolvedValue([mockCourse] as any);

      const res = await request(app).get("/api/v1/admin/courses").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].code).toBe("CMP 211");
    });
  });

  describe("Sessions API", () => {
    it("POST /api/v1/admin/sessions creates academic session", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.academicSession, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.academicSession, "create").mockResolvedValue(mockSession as any);

      const res = await request(app).post("/api/v1/admin/sessions").set("Cookie", cookie).send({
        name: "2023/2024",
        startYear: 2023,
        endYear: 2024,
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("2023/2024");
    });
  });

  describe("Results API & Grade Computation", () => {
    it("POST /api/v1/admin/results calculates grade and point automatically from score", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(mockStudent as any);
      vi.spyOn(prisma.course, "findUnique").mockResolvedValue(mockCourse as any);
      vi.spyOn(prisma.academicSession, "findUnique").mockResolvedValue(mockSession as any);
      vi.spyOn(prisma.result, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.graduationRequirement, "findUnique").mockResolvedValue(defaultDeptReq as any);
      vi.spyOn(prisma.result, "create").mockResolvedValue({
        id: "result-1",
        studentId: mockStudent.id,
        courseId: mockCourse.id,
        sessionId: mockSession.id,
        score: 75,
        grade: "A",
        gradePoint: 5,
        course: { code: "CMP 211", title: "Computer Programming I", units: 3, isCompulsory: true },
      } as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

      const res = await request(app).post("/api/v1/admin/results").set("Cookie", cookie).send({
        studentId: mockStudent.id,
        courseId: mockCourse.id,
        sessionId: mockSession.id,
        score: 75,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        score: 75,
        grade: "A",
        gradePoint: 5,
        passed: true,
      });
    });

    it("POST /api/v1/admin/results enforces unique constraint on (studentId, courseId, sessionId)", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(mockStudent as any);
      vi.spyOn(prisma.course, "findUnique").mockResolvedValue(mockCourse as any);
      vi.spyOn(prisma.academicSession, "findUnique").mockResolvedValue(mockSession as any);
      vi.spyOn(prisma.result, "findUnique").mockResolvedValue({ id: "existing-result" } as any);

      const res = await request(app).post("/api/v1/admin/results").set("Cookie", cookie).send({
        studentId: mockStudent.id,
        courseId: mockCourse.id,
        sessionId: mockSession.id,
        score: 80,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("already exists");
    });

    it("PATCH /api/v1/admin/results/:id recomputes grade and point on score update", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.result, "findUnique").mockResolvedValue({
        id: "result-1",
        course: mockCourse,
      } as any);
      vi.spyOn(prisma.graduationRequirement, "findUnique").mockResolvedValue(defaultDeptReq as any);
      vi.spyOn(prisma.result, "update").mockResolvedValue({
        id: "result-1",
        score: 42,
        grade: "E",
        gradePoint: 1,
        course: { code: "CMP 211", title: "Computer Programming I", units: 3, isCompulsory: true },
      } as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

      const res = await request(app)
        .patch("/api/v1/admin/results/result-1")
        .set("Cookie", cookie)
        .send({ score: 42 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        score: 42,
        grade: "E",
        gradePoint: 1,
        passed: true,
      });
    });
  });

  describe("CSV Import with Error Reporting", () => {
    it("POST /api/v1/admin/results/import parses CSV and reports imported, skipped, and errors", async () => {
      const cookie = await getAdminCookie();
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.course, "findMany").mockResolvedValue([mockCourse] as any);
      vi.spyOn(prisma.academicSession, "findMany").mockResolvedValue([mockSession] as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockImplementation(async (args: any) => {
        if (args.where.matricNumber === "CSC/2021/999") {
          return mockStudent as any;
        }
        return null;
      });
      vi.spyOn(prisma.result, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.graduationRequirement, "findUnique").mockResolvedValue(defaultDeptReq as any);
      vi.spyOn(prisma.result, "create").mockResolvedValue({ id: "imported-1" } as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

      const csvContent = [
        "matricNumber,courseCode,session,score",
        "CSC/2021/999,CMP 211,2023/2024,88", // valid row
        "NON_EXISTENT_MATRIC,CMP 211,2023/2024,70", // invalid student
        "CSC/2021/999,UNKNOWN_COURSE,2023/2024,70", // invalid course
        "CSC/2021/999,CMP 211,2023/2024,150", // invalid score > 100
      ].join("\n");

      const res = await request(app)
        .post("/api/v1/admin/results/import")
        .set("Cookie", cookie)
        .attach("file", Buffer.from(csvContent), "results.csv");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("imported", 1);
      expect(res.body).toHaveProperty("skipped", 0);
      expect(res.body).toHaveProperty("errors");
      expect(res.body.errors).toHaveLength(3);
      expect(res.body.errors[0]).toMatchObject({
        row: 3,
        message: expect.stringContaining("not found"),
      });
    });
  });
});
