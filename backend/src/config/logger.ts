import winston from "winston";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), process.env.LOG_DIRECTORY || "logs");
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Redacts middle digits of a phone number.
 * e.g. "919876543210" -> "91******3210"
 */
export const maskPhone = (val: string): string => {
  const digits = val.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 15) {
    return digits.slice(0, 2) + "*".repeat(digits.length - 6) + digits.slice(-4);
  }
  return val;
};

/**
 * Traverses objects recursively to find phone numbers or key names containing "phone"
 * and masks them to preserve privacy.
 */
const recursiveMaskObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") {
    // If it's a string that matches a phone pattern, mask it
    if (typeof obj === "string" && /^\+?\d{7,15}$/.test(obj)) {
      return maskPhone(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(recursiveMaskObject);
  }

  const maskedObj: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const lowKey = key.toLowerCase();
    
    // Skip logging sensitive credentials
    if (
      lowKey.includes("password") ||
      lowKey.includes("hash") ||
      lowKey.includes("token") ||
      lowKey.includes("cookie") ||
      lowKey.includes("auth") ||
      lowKey.includes("secret")
    ) {
      maskedObj[key] = "[REDACTED]";
    } else if (lowKey.includes("phone") || lowKey.includes("mobile")) {
      if (typeof val === "string") {
        maskedObj[key] = maskPhone(val);
      } else {
        maskedObj[key] = val;
      }
    } else {
      maskedObj[key] = recursiveMaskObject(val);
    }
  }
  return maskedObj;
};

// Custom Winston format to apply masking and format metadata
const maskFormat = winston.format((info) => {
  const { message, ...meta } = info;
  
  if (typeof message === "string") {
    // Regex mask for phone numbers in message strings
    info.message = message.replace(/\b\d{7,15}\b/g, (match) => maskPhone(match));
  }
  
  // Recursively mask metadata properties
  if (meta && Object.keys(meta).length > 0) {
    const maskedMeta = recursiveMaskObject(meta);
    Object.assign(info, maskedMeta);
  }
  
  return info;
});

const isProduction = process.env.NODE_ENV === "production";

// Winston Logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    maskFormat(),
    isProduction ? winston.format.json() : winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const reqIdStr = requestId ? ` [ReqID: ${requestId}]` : "";
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
          return `[${timestamp}] ${level}:${reqIdStr} ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Configure file transports in production
if (isProduction) {
  logger.add(
    new winston.transports.File({
      filename: path.join(LOGS_DIR, "errors.log"),
      level: "error",
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(LOGS_DIR, "combined.log"),
    })
  );
}
