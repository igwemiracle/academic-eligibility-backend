import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Object-Level Authorization", () => {
  const password = "Password123!";
  const passwordHash = bcrypt.hashSync(password, 10);

  const studentAUser = {
    id: "user-student-a",
    email: "studentA@example.com",
    fullName: "Student A",
    passwordHash,
    role: "STUDENT" as const,
    isActive: true,
    studentProfile: { id: "profile-a" },
  };

  const studentBUser = {
    id: "user-student-b",
    email: "studentB@example.com",
    fullName: "Student B",
    passwordHash,
    role: "STUDENT" as const,
    isActive: true,
    studentProfile: { id: "profile-b" },
  };

  const adviser1User = {
    id: "user-adviser-1",
    email: "adviser1@example.com",
    fullName: "Adviser One",
    passwordHash,
    role: "ADVISER" as const,
    isActive: true,
    studentProfile: null,
  };

  const adminUser = {
    id: "user-admin",
    email: "admin@example.com",
    fullName: "Admin Officer",
    passwordHash,
    role: "ADMIN" as const,
    isActive: true,
    studentProfile: null,
  };

  const studentAProfile = {
    id: "profile-a",
    userId: "user-student-a",
    departmentId: "dept-cs",
    matricNumber: "CSC/2020/A01",
    level: 300,
    entryYear: 2020,
    entryMode: "UTME" as const,
    adviserId: "user-adviser-1", // Assigned to Adviser 1
    user: { fullName: "Student A", email: "studentA@example.com" },
    department: { id: "dept-cs", name: "Computer Science", code: "CSC" },
  };

  const studentBProfile = {
    id: "profile-b",
    userId: "user-student-b",
    departmentId: "dept-cs",
    matricNumber: "CSC/2020/B02",
    level: 300,
    entryYear: 2020,
    entryMode: "UTME" as const,
    adviserId: "user-adviser-2", // Assigned to Adviser 2
    user: { fullName: "Student B", email: "studentB@example.com" },
    department: { id: "dept-cs", name: "Computer Science", code: "CSC" },
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

  async function getLoginCookie(user: any) {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(user as any);
    const res = await request(app).post("/api/v1/auth/login").send({ email: user.email, password });
    return res.headers["set-cookie"];
  }

  describe("Student Object-Level Authorization", () => {
    it("Student cannot access adviser routes (returns 403 Forbidden)", async () => {
      const cookie = await getLoginCookie(studentAUser);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(studentAUser as any);

      const res = await request(app).get("/api/v1/adviser/students").set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("Student can only read their own progress via /me/progress", async () => {
      const cookie = await getLoginCookie(studentAUser);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(studentAUser as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(studentAProfile as any);
      vi.spyOn(prisma.graduationRequirement, "findFirst").mockResolvedValue(defaultDeptReq as any);
      vi.spyOn(prisma.course, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.result, "findMany").mockResolvedValue([]);

      const res = await request(app).get("/api/v1/me/progress").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.student.matricNumber).toBe("CSC/2020/A01");
      expect(res.body.student.id).toBe(studentAProfile.id);
    });
  });

  describe("Adviser Object-Level Authorization", () => {
    it("Adviser 1 can read assigned Student A's progress", async () => {
      const cookie = await getLoginCookie(adviser1User);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adviser1User as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(studentAProfile as any);
      vi.spyOn(prisma.graduationRequirement, "findFirst").mockResolvedValue(defaultDeptReq as any);
      vi.spyOn(prisma.course, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.result, "findMany").mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/v1/adviser/students/${studentAProfile.id}/progress`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.student.matricNumber).toBe("CSC/2020/A01");
    });

    it("Adviser 1 CANNOT read unassigned Student B's progress (returns 403 Forbidden)", async () => {
      const cookie = await getLoginCookie(adviser1User);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adviser1User as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(studentBProfile as any);

      const res = await request(app)
        .get(`/api/v1/adviser/students/${studentBProfile.id}/progress`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: "FORBIDDEN",
        message: "You are not assigned as an adviser for this student",
      });
    });

    it("Adviser 1 CANNOT read unassigned Student B's results (returns 403 Forbidden)", async () => {
      const cookie = await getLoginCookie(adviser1User);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adviser1User as any);
      vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue(studentBProfile as any);

      const res = await request(app)
        .get(`/api/v1/adviser/students/${studentBProfile.id}/results`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("Adviser 1 can read student roster using batch evaluation", async () => {
      const cookie = await getLoginCookie(adviser1User);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adviser1User as any);
      vi.spyOn(prisma.studentProfile, "findMany").mockResolvedValue([studentAProfile as any]);
      vi.spyOn(prisma.graduationRequirement, "findMany").mockResolvedValue([defaultDeptReq as any]);
      vi.spyOn(prisma.course, "findMany").mockResolvedValue([]);
      vi.spyOn(prisma.result, "findMany").mockResolvedValue([]);

      const res = await request(app).get("/api/v1/adviser/students").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].matricNumber).toBe("CSC/2020/A01");
      expect(res.body.total).toBe(1);
    });
  });

  describe("Admin Authorization", () => {
    it("Admin can access system stats", async () => {
      const cookie = await getLoginCookie(adminUser);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.studentProfile, "findMany").mockResolvedValue([]);

      const res = await request(app).get("/api/v1/admin/stats").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalStudents", 0);
      expect(res.body).toHaveProperty("byStatus");
      expect(res.body).toHaveProperty("averageCgpa", 0);
    });
  });
});
