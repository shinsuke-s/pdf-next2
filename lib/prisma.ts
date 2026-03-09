import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VERCEL ? 'file:/tmp/dev.db' : 'file:./prisma/dev.db';
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  annotationTableReady?: Promise<void>;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function ensureAnnotationTable() {
  if (globalForPrisma.annotationTableReady) {
    return globalForPrisma.annotationTableReady;
  }

  globalForPrisma.annotationTableReady = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Annotation" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "page" INTEGER NOT NULL,
        "x" REAL NOT NULL,
        "y" REAL NOT NULL,
        "mode" TEXT NOT NULL DEFAULT 'point',
        "points" TEXT,
        "value" REAL NOT NULL,
        "unit" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "comment" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Annotation" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'point'`);
    } catch {
      // Already exists
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Annotation" ADD COLUMN "points" TEXT`);
    } catch {
      // Already exists
    }
  })();

  try {
    await globalForPrisma.annotationTableReady;
  } catch (error) {
    globalForPrisma.annotationTableReady = undefined;
    throw error;
  }
}
