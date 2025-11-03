/**
 * Winston Logger Configuration
 * Provides structured logging for Cortex Bridge
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevel = process.env.LOG_LEVEL || "info";
const nodeEnv = process.env.NODE_ENV || "development";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format (human-readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

// Create logs directory if it doesn't exist
import { mkdirSync, existsSync } from "fs";

// Detect if running in Docker (check for .dockerenv file or if we're in /app/server.js)
const isDocker = existsSync("/.dockerenv") || __dirname.startsWith("/app");
const logsDir = isDocker ? "/app/logs" : path.join(__dirname, "../../logs");

try {
  mkdirSync(logsDir, { recursive: true });
} catch (error) {
  console.warn(`Warning: Could not create logs directory: ${error.message}`);
}

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: "cortex-bridge" },
  transports: [
    // Console output (always enabled)
    new winston.transports.Console({
      format: nodeEnv === "production" ? logFormat : consoleFormat,
    }),

    // File output - errors (optional, fail silently if can't create)
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      handleExceptions: true,
    }),

    // File output - combined (optional, fail silently if can't create)
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

export default logger;
