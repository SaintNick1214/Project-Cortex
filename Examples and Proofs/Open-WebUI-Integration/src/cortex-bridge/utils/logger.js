/**
 * Winston Logger Configuration
 * Provides structured logging for Cortex Bridge
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (human-readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'cortex-bridge' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: nodeEnv === 'production' ? logFormat : consoleFormat
    }),
    
    // File output - errors
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // File output - combined
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
const logsDir = path.join(__dirname, '../../logs');
try {
  mkdirSync(logsDir, { recursive: true });
} catch (error) {
  // Directory might already exist
}

export default logger;

