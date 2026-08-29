import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { todayBJ, addDaysBJ } from "../../src/lib/time";
import { touchActivity } from "../../src/lib/streak";
import { createTestUser } from "./helpers";

/**
 * 连续学习专项（§6.3 判定公式 + §12.2 断签不回退）
 * 直连真实数据库，用独立测试用户构造各 lastActiveDay 场景。
 */
const prisma = new PrismaClient();
const TEST_EMAIL = `vitest-streak-${process.pid}-${Date.now()}@test.local`;
let userId = "";

beforeAll(async () => {
  const u = await createTestUser(prisma, {
      
      email: TEST_EMAIL,
      nickname: "vitest-streak",
      registeredDay: todayBJ(),
      qaResetDate: todayBJ(),
    
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.userBadge.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

async function setActivity(lastActiveDay: string | null, current: number, best: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveDay, streakCurrent: current, streakBest: best },
  });
}

async function readStreak() {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastActiveDay: true, streakCurrent: true, streakBest: true },
  });
  return u;
}

describe("touchActivity 断签判定公式", () => {
  it("首次活跃（lastActiveDay=null）→ streakCurrent=1", async () => {
    await setActivity(null, 0, 0);
    await touchActivity(userId);
    const u = await readStreak();
    expect(u.streakCurrent).toBe(1);
    expect(u.streakBest).toBe(1);
    expect(u.lastActiveDay).toBe(todayBJ());
  });

  it("当日重复活跃 → 不重复计数（不增不减）", async () => {
    await setActivity(todayBJ(), 5, 9);
    await touchActivity(userId);
    const u = await readStreak();
    expect(u.streakCurrent).toBe(5);
    expect(u.streakBest).toBe(9);
  });

  it("昨日活跃（=23:59 学习次日 00:01 再学的判定路径）→ 续签 +1", async () => {
    const yesterday = addDaysBJ(todayBJ(), -1);
    await setActivity(yesterday, 4, 4);
    await touchActivity(userId);
    const u = await readStreak();
    expect(u.streakCurrent).toBe(5);
    expect(u.streakBest).toBe(5);
  });

  it("续签时 streakBest 只升不降：best=10 > 新 current", async () => {
    await setActivity(addDaysBJ(todayBJ(), -1), 1, 10);
    await touchActivity(userId);
    const u = await readStreak();
    expect(u.streakCurrent).toBe(2);
    expect(u.streakBest).toBe(10); // 永不回退
  });

  it("断签（lastActiveDay=两天前）→ 重置为 1，且 streakBest 不回退", async () => {
    await setActivity(addDaysBJ(todayBJ(), -2), 7, 9);
    await touchActivity(userId);
    const u = await readStreak();
    expect(u.streakCurrent).toBe(1);
    expect(u.streakBest).toBe(9);
  });

  it("断签后徽章不剥夺：best 已达 7 的用户断签后 streak_7 勋章逻辑仍以 best 判定", async () => {
    // 断签场景构造：best=7（曾达成七日同行）
    await setActivity(addDaysBJ(todayBJ(), -30), 1, 7);
    await touchActivity(userId);
    const u = await readStreak();
    expect(Math.max(u.streakCurrent, u.streakBest)).toBe(7); // 任一达标即永久获得（§9.2）
  });
});
