import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const parsePositiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

/**
 * Applies connection settings as URL query parameters, which the MariaDB driver
 * reads natively. Values already present in DATABASE_URL win, so a deployment
 * can always override these defaults from the connection string itself.
 */
const buildConnectionUrl = (): string => {
  const url = new URL(databaseUrl);

  // RDS instances with `require_secure_transport = ON` reject plaintext
  // connections, so TLS defaults on in production.
  const sslEnabled =
    process.env.DATABASE_SSL === "true" ||
    (process.env.DATABASE_SSL === undefined && process.env.NODE_ENV === "production");

  if (sslEnabled && !url.searchParams.has("ssl")) {
    url.searchParams.set("ssl", "true");
  }

  // The pool is shared by the API and both workers, so each task's limit must be
  // sized against the RDS max_connections budget rather than left unbounded.
  if (!url.searchParams.has("connectionLimit")) {
    url.searchParams.set(
      "connectionLimit",
      String(parsePositiveInt("DATABASE_CONNECTION_LIMIT", 10))
    );
  }

  if (!url.searchParams.has("connectTimeout")) {
    url.searchParams.set(
      "connectTimeout",
      String(parsePositiveInt("DATABASE_CONNECT_TIMEOUT_MS", 15000))
    );
  }

  return url.toString();
};

const adapter = new PrismaMariaDb(buildConnectionUrl());

export const prisma = new PrismaClient({ adapter });
