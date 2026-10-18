import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("Auth API", () => {
  const testPassword = "Password123!";
  const testHash = bcrypt.hashSync(testPassword, 10);

  const mockUser = {
    id: "user-123",
    email: "authtest@example.com",
    fullName: "Auth Test User",
    passwordHash: testHash,
    role: "ADMIN" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    studentProfile: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in successfully with valid credentials, sets cookie, and returns user without passwordHash", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: "ADMIN",
      });
      expect(res.body.user).not.toHaveProperty("passwordHash");

      // Check cookie
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("access_token="))).toBe(true);
    });

    it("returns 401 with generic error message on invalid password", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: "WrongPassword!" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    });

    it("returns 401 on non-existent user", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "nonexistent@example.com", password: testPassword });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    });

    it("returns 400 validation error if body fields are invalid", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "not-an-email", password: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns 401 if unauthenticated", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns authenticated user info when valid cookie is provided", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      // Login to get cookie
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: testPassword });

      const cookie = loginRes.headers["set-cookie"];

      const res = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.fullName,
        role: "ADMIN",
      });
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("clears access_token cookie", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: testPassword });

      const cookie = loginRes.headers["set-cookie"];

      const res = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Logged out successfully");

      const clearedCookies = res.headers["set-cookie"];
      expect(clearedCookies.some((c: string) => c.includes("access_token=;"))).toBe(true);
    });
  });

  describe("POST /api/v1/auth/change-password", () => {
    it("enforces minimum password length of 8", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: testPassword });

      const cookie = loginRes.headers["set-cookie"];

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Cookie", cookie)
        .send({ currentPassword: testPassword, newPassword: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("updates password when current password is valid", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUser,
        passwordHash: "newHash",
      } as any);

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "authtest@example.com", password: testPassword });

      const cookie = loginRes.headers["set-cookie"];
      const newPassword = "NewStrongPassword123!";

      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Cookie", cookie)
        .send({ currentPassword: testPassword, newPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Password updated successfully");
    });
  });
});
