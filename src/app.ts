import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";

// Import modules
import { authRouter } from "./modules/auth/routes.js";
import { meRouter, adviserRouter, statsRouter } from "./modules/progress/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { coursesRouter } from "./modules/courses/routes.js";
import { sessionsRouter } from "./modules/sessions/routes.js";
import { resultsRouter } from "./modules/results/routes.js";
import { requirementsRouter } from "./modules/requirements/routes.js";
import { auditRouter } from "./modules/audit/routes.js";

export const app = express();

// Trust reverse proxy (essential for Render / HTTPS / secure cookies / rate limiting)
app.set("trust proxy", 1);

// Security and utility middleware
app.use(helmet());

const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

// Request logger (do not log passwords, tokens, or sensitive bodies)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Health check endpoint
app.get(["/health", "/api/v1/health"], (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// Mount API v1 Routers
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/adviser", adviserRouter);
app.use("/api/v1/admin", statsRouter);
app.use("/api/v1/admin", usersRouter);
app.use("/api/v1/admin", coursesRouter);
app.use("/api/v1/admin", sessionsRouter);
app.use("/api/v1/admin", resultsRouter);
app.use("/api/v1/admin", requirementsRouter);
app.use("/api/v1/admin", auditRouter);

// 404 Not Found Handler for unmatched routes
app.use((req: Request, _res: Response, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handler
app.use(errorHandler);
