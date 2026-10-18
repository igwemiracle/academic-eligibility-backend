import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Users API", () => {
  const password = "Password123!";
  const passwordHash = bcrypt.hashSync(password, 10);

  const adminUser = {
    id: "user-admin",
    email: "admin@example.com",
    fullName: "Admin Officer",
    passwordHash,
    role: "ADMIN" as const,
    isActive: true,
    studentProfile: null,
  };

  const adviserUser = {
    id: "user-adviser",
    email: "adviser@example.com",
    fullName: "Adviser Person",
    passwordHash,
    role: "ADVISER" as const,
    isActive: true,
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

  it("GET /api/v1/admin/users lists users with pagination", async () => {
    const cookie = await getAdminCookie();
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);
    vi.spyOn(prisma.user, "count").mockResolvedValue(1);
    vi.spyOn(prisma.user, "findMany").mockResolvedValue([adminUser] as any);

    const res = await request(app).get("/api/v1/admin/users").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total", 1);
  });

  it("POST /api/v1/admin/users creates an ADVISER user", async () => {
    const cookie = await getAdminCookie();
    vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
      if (args.where.id === "user-admin") return adminUser as any;
      return null;
    });
    vi.spyOn(prisma.user, "create").mockResolvedValue({
      id: "new-adv-id",
      email: "newadviser@example.com",
      fullName: "New Adviser",
      role: "ADVISER",
      isActive: true,
      createdAt: new Date(),
    } as any);

    const res = await request(app).post("/api/v1/admin/users").set("Cookie", cookie).send({
      email: "newadviser@example.com",
      fullName: "New Adviser",
      password: "Password123!",
      role: "ADVISER",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: "newadviser@example.com",
      fullName: "New Adviser",
      role: "ADVISER",
    });
  });

  it("POST /api/v1/admin/students/:studentId/adviser assigns adviser to student", async () => {
    const cookie = await getAdminCookie();
    vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
      if (args.where.id === "user-admin") return adminUser as any;
      if (args.where.id === "user-adviser") return adviserUser as any;
      return null;
    });

    vi.spyOn(prisma.studentProfile, "findUnique").mockResolvedValue({
      id: "student-prof-1",
      userId: "user-student-1",
      matricNumber: "CSC/2020/001",
    } as any);

    vi.spyOn(prisma.studentProfile, "update").mockResolvedValue({
      id: "student-prof-1",
      adviserId: "user-adviser",
    } as any);

    const res = await request(app)
      .post("/api/v1/admin/students/student-prof-1/adviser")
      .set("Cookie", cookie)
      .send({ adviserId: "user-adviser" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Adviser assigned successfully");
  });

  it("PATCH /api/v1/admin/users/:id/deactivate deactivates a user", async () => {
    const cookie = await getAdminCookie();
    vi.spyOn(prisma.user, "findUnique").mockImplementation(async (args: any) => {
      if (args.where.id === "user-admin") return adminUser as any;
      return { id: "target-user", isActive: true } as any;
    });
    vi.spyOn(prisma.user, "update").mockResolvedValue({
      id: "target-user",
      isActive: false,
    } as any);

    const res = await request(app)
      .patch("/api/v1/admin/users/target-user/deactivate")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "User deactivated successfully");
  });
});
