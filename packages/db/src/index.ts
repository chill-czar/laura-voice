import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/**
 * Single shared PrismaClient. Postgres is the durable source of truth
 * (CLAUDE.md §29) — nothing outside CaseService/AppointmentService/
 * CallLogService should import this directly.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
