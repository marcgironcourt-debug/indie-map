import { PrismaClient } from "@prisma/client";
import path from "node:path";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function normalizeDbUrl(u: string | undefined): string | undefined {
  if (!u) return u;
  if (!u.startsWith("file:")) return u;
  const p = u.slice("file:".length);
  if (!p) return u;
  if (p.startsWith("/")) return u;
  return "file:" + path.resolve(p);
}

if (process.env.NODE_ENV !== "production") {
  process.env.DATABASE_URL = normalizeDbUrl(process.env.DATABASE_URL);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
