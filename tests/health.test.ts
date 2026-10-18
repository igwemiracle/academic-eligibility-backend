import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Health Check API", () => {
  it("GET /api/v1/health returns 200 and status ok", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("env");
  });

  it("GET /api/v1/nonexistent returns 404 in standardized error format", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Route not found: GET /api/v1/nonexistent",
      details: [],
    });
  });
});
