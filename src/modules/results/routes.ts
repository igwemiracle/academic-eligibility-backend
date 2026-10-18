import { Router } from "express";
import multer from "multer";
import { ResultsController } from "./controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { Role } from "@prisma/client";
import { createResultSchema, queryResultSchema, updateResultSchema } from "./schema.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export const resultsRouter = Router();

// Endpoint 15: Results GET/POST /admin/results, PATCH /admin/results/:id, POST /admin/results/import
resultsRouter.use(requireAuth, requireRole(Role.ADMIN));

resultsRouter.get("/results", validate({ query: queryResultSchema }), ResultsController.list);
resultsRouter.post("/results", validate({ body: createResultSchema }), ResultsController.create);
resultsRouter.patch(
  "/results/:id",
  validate({ body: updateResultSchema }),
  ResultsController.update,
);
resultsRouter.post("/results/import", upload.single("file"), ResultsController.importCsv);
