/**
 * 测试工具：把五集合当前状态导出为 JSON（剔除 createdAt，按 id 排序），
 * 用于同步脚本的幂等比对与回滚验证。
 *
 * 用法：npx tsx scripts/snapshot-db.ts <输出文件>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(join(ROOT, "llm-platform", ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

function stripCreated<T extends { createdAt?: Date }>(rows: T[]) {
  return rows
    .map(({ createdAt: _createdAt, ...rest }) => rest)
    .sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)));
}

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("用法：npx tsx scripts/snapshot-db.ts <输出文件>");
    process.exit(1);
  }
  const [modules, chapters, sections, exercises, chunks] = await Promise.all([
    prisma.llmModule.findMany(),
    prisma.llmChapter.findMany(),
    prisma.llmSection.findMany({ orderBy: { order: "asc" } }),
    prisma.llmExercise.findMany({ orderBy: { order: "asc" } }),
    prisma.knowledgeChunk.findMany(),
  ]);
  const dump = {
    modules: stripCreated(modules),
    chapters: stripCreated(chapters),
    sections: stripCreated(sections),
    exercises: stripCreated(exercises),
    chunks: stripCreated(chunks).sort((a, b) =>
      `${a.sectionId}:${a.body}`.localeCompare(`${b.sectionId}:${b.body}`)
    ),
  };
  writeFileSync(out, JSON.stringify(dump, null, 2), "utf8");
  console.log(`快照已写入 ${out}（模块 ${dump.modules.length} / 章节 ${dump.chapters.length} / 小节 ${dump.sections.length} / 习题 ${dump.exercises.length} / 知识块 ${dump.chunks.length}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
