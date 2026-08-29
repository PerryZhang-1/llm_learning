/**
 * 一次性数据库准备脚本（R2-A）：在 Neon PostgreSQL 上启用 pgvector 扩展。
 * 必须在 `prisma db push` 之前执行（KnowledgeChunk.embedding 是 vector(1024) 列）。
 *
 * 用法：npx tsx scripts/enable-pgvector.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  const rows = await prisma.$queryRaw<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `;
  console.log(`pgvector 扩展就绪：${rows[0]?.extname ?? "未找到!"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
