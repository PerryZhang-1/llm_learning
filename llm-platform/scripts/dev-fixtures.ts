/**
 * 开发测试夹具：创建一个同步测试用户及其进度/错题/反馈/积分流水，
 * 用于验证「内容全量重灌不伤用户数据」。幂等（按 email/唯一键 upsert）。
 *
 * 用法：npx tsx scripts/dev-fixtures.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(join(ROOT, "llm-platform", ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();
const EMAIL = "sync-test@example.com";
const DAY = "2026-08-29";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      email: EMAIL,
      nickname: "同步测试用户",
      registeredDay: DAY,
      qaResetDate: DAY,
      lastActiveDay: DAY,
    },
  });

  const section = await prisma.llmSection.findUnique({ where: { id: "sec-py-basics" } });
  const exercise = await prisma.llmExercise.findUnique({ where: { id: "ex-py-1" } });
  if (!section || !exercise) {
    throw new Error("前置内容缺失（sec-py-basics / ex-py-1）：请先完成内容同步或 seed");
  }

  const progress = await prisma.userProgress.upsert({
    where: { userId_sectionId: { userId: user.id, sectionId: section.id } },
    update: { completed: true, completedAt: new Date() },
    create: { userId: user.id, sectionId: section.id, completed: true, completedAt: new Date() },
  });

  const wrongBook = await prisma.wrongBook.upsert({
    where: { userId_exerciseId: { userId: user.id, exerciseId: exercise.id } },
    update: { attempts: 2, lastResult: false, conquered: false },
    create: { userId: user.id, exerciseId: exercise.id, attempts: 2, lastResult: false },
  });

  const feedback = await prisma.feedback.findFirst({
    where: { userId: user.id, sectionId: section.id },
  });
  const fb =
    feedback ??
    (await prisma.feedback.create({
      data: { userId: user.id, sectionId: section.id, content: "同步测试反馈：代码示例希望标注 Python 版本。" },
    }));

  const pointsLog = await prisma.pointsLog.upsert({
    where: {
      userId_type_refId_dayKey: {
        userId: user.id, type: "SECTION_DONE", refId: section.id, dayKey: DAY,
      },
    },
    update: {},
    create: { userId: user.id, type: "SECTION_DONE", refId: section.id, dayKey: DAY, delta: 10 },
  });

  console.log(`夹具就绪：用户 ${user.id}（${EMAIL}）`);
  console.log(`  进度 ${progress.id} → 小节 ${progress.sectionId}`);
  console.log(`  错题本 ${wrongBook.id} → 习题 ${wrongBook.exerciseId}`);
  console.log(`  反馈 ${fb.id} → 小节 ${fb.sectionId}`);
  console.log(`  积分流水 ${pointsLog.id}（+${pointsLog.delta}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
