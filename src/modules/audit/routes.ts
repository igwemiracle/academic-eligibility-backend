import { Router } from "express";
import { AuditController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Role } from "@prisma/client";

export const auditRouter = Router();

// Endpoint 17: GET /admin/audit-logs?page=
auditRouter.get("/audit-logs", requireAuth, requireRole(Role.ADMIN), AuditController.list);
