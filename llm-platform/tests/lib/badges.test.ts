import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { todayBJ } from "../../src/lib/time";
import { createTestUser } from "./helpers";
import { grantBadge, checkBadgesAfterActivity } from "../../src/lib/badges";

/**
 * 徽章引擎专项（§9.2：永久获得、永不回收、幂等授予）
 */
const prisma = new PrismaClient();
const TEST_EMAIL = `vitest-badge-${process.pid}-${Date.now()}@test.local`;
let userId = "";

beforeAll(async () => {
  const u = await createTestUser(prisma, {
      
      email: TEST_EMAIL,
      nickname: "vitest-badge",
      registeredDay: todayBJ(),
      qaResetDate: todayBJ(),
    
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.userBadge.deleteMany({ where: { userId } });
  await prisma.userProgress.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("grantBadge 幂等授予", () => {
  it("首次授予返回 true，重复授予返回 false 且不产生第二条记录", async () => {
    expect(await grantBadge(userId, "first_step")).toBe(true);
    expect(await grantBadge(userId, "first_step")).toBe(false);
    const rows = await prisma.userBadge.findMany({ where: { userId, badgeCode: "first_step" } });
    expect(rows).toHaveLength(1);
  });
});

describe("checkBadgesAfterActivity 事件检查", () => {
  it("完成 1 个小节 → 授予启程者；重复调用幂等（不再返回新勋章）", async () => {
    await prisma.userBadge.deleteMany({ where: { userId, badgeCode: "first_step" } });
    const section = await prisma.llmSection.findFirstOrThrow({ select: { id: true } });
    await prisma.userProgress.create({
      data: { userId, sectionId: section.id, completed: true, completedAt: new Date() },
    });

    const first = await checkBadgesAfterActivity(userId);
    expect(first).toContain("first_step");

    const second = await checkBadgesAfterActivity(userId);
    expect(second).not.toContain("first_step"); // 已拥有 → 静默跳过
  });

  it("完成一整章 → 授予章节探索家", async () => {
    // 选一个完整章节，把它的全部小节标记完成
    const chapter = await prisma.llmChapter.findFirstOrThrow({
      include: { sections: { select: { id: true } } },
      where: { sections: { some: {} } },
    });
    for (const s of chapter.sections) {
      await prisma.userProgress.upsert({
        where: { userId_sectionId: { userId, sectionId: s.id } },
        update: { completed: true, completedAt: new Date() },
        create: { userId, sectionId: s.id, completed: true, completedAt: new Date() },
      });
    }

    await prisma.userBadge.deleteMany({ where: { userId, badgeCode: "chapter_done" } });
    const earned = await checkBadgesAfterActivity(userId);
    expect(earned).toContain("chapter_done");
  });

  it("连续学习勋章：best 任一达标即授予且断签后不回收（以 streakBest=7 构造）", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { streakCurrent: 1, streakBest: 7 }, // 曾达成七日，如今断签
    });
    await prisma.userBadge.deleteMany({ where: { userId, badgeCode: { in: ["streak_3", "streak_7"] } } });
    const earned = await checkBadgesAfterActivity(userId);
    expect(earned).toContain("streak_7");
    expect(earned).toContain("streak_3");

    // 断签再查：勋章仍在（永不回收）
    const badges = await prisma.userBadge.findMany({ where: { userId, badgeCode: "streak_7" } });
    expect(badges).toHaveLength(1);
  });
});
