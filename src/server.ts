import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
  });
});
