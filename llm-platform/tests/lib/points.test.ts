import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { todayBJ } from "../../src/lib/time";
import { createTestUser } from "./helpers";
import { awardPoints } from "../../src/lib/points";

/**
 * 积分引擎专项（§9.1 + §7.2 规则1/2 + §12.1/12.2）：
 * 幂等唯一约束、分源封顶、总量封顶、delta 硬校验——直连真实数据库验证真约束。
 */
const prisma = new PrismaClient();
const TEST_EMAIL = `vitest-points-${process.pid}-${Date.now()}@test.local`;
let userId = "";

beforeAll(async () => {
  const u = await createTestUser(prisma, {
      
      email: TEST_EMAIL,
      nickname: "vitest-points",
      registeredDay: todayBJ(),
      qaResetDate: todayBJ(),
    
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.pointsLog.deleteMany({ where: { userId } });
  await prisma.dailyPointCap.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

async function userPoints() {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
  return u.points;
}

describe("幂等：同用户+同类型+同对象+同日仅计一次（§7.2 规则2）", () => {
  it("同一 refId 重复提交 → 第二次 already_awarded，积分不变", async () => {
    const first = await awardPoints(userId, "SECTION_DONE", "sec-idem-test");
    expect(first).toMatchObject({ awarded: true, points: 10, reason: "ok" });

    const second = await awardPoints(userId, "SECTION_DONE", "sec-idem-test");
    expect(second).toMatchObject({ awarded: false, points: 0, reason: "already_awarded" });

    expect(await userPoints()).toBe(10);
    const logs = await prisma.pointsLog.findMany({
      where: { userId, type: "SECTION_DONE", refId: "sec-idem-test" },
    });
    expect(logs).toHaveLength(1);
  });

  it("不同 refId 正常加分（互不影响）", async () => {
    const r = await awardPoints(userId, "SECTION_DONE", "sec-idem-test-b");
    expect(r.awarded).toBe(true);
    expect(await userPoints()).toBe(20);
  });
});

describe("delta 硬校验（公理：只增不减，不存在扣分代码路径）", () => {
  it("POINT_VALUES 全部为正数", async () => {
    const { POINT_VALUES } = await import("../../src/lib/points");
    for (const v of Object.values(POINT_VALUES)) expect(v).toBeGreaterThan(0);
  });
});

describe("分源封顶（§9.1：习题 ≤30/日）", () => {
  it("习题积分到 30 封顶：第 7 次提交 reason=daily_source_cap，且动作本身不受影响", async () => {
    let capHit = false;
    let total = 0;
    for (let i = 1; i <= 7; i++) {
      const r = await awardPoints(userId, "EXERCISE_SUBMIT", `ex-cap-${i}`);
      if (r.reason === "daily_source_cap") {
        capHit = true;
        expect(r.awarded).toBe(false);
      } else {
        total += r.points;
      }
    }
    expect(capHit).toBe(true);
    expect(total).toBe(30); // 恰好封顶：6 次 × 5 分
  });
});

describe("总量封顶（§9.1：单人 ≤200/日）", () => {
  it("累计达 200 后 reason=daily_total_cap，进度与流水不再增加但也不报错", async () => {
    // 此前已 20（SECTION_DONE 10×2）+ 30（习题封顶）= 50；SECTION_DONE 换 refId 加到 200
    let ref = 0;
    while ((await userPoints()) < 200 && ref < 20) {
      ref++;
      await awardPoints(userId, "SECTION_DONE", `sec-total-${ref}`);
    }
    expect(await userPoints()).toBe(200);

    const blocked = await awardPoints(userId, "SECTION_DONE", "sec-total-blocked");
    expect(blocked).toMatchObject({ awarded: false, reason: "daily_total_cap" });
    expect(await userPoints()).toBe(200); // 只增不减，且封顶后不再增加
  });
});

describe("时间口径（规则 11）", () => {
  it("流水 dayKey 均为北京时间今日", async () => {
    const logs = await prisma.pointsLog.findMany({ where: { userId }, select: { dayKey: true } });
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l.dayKey).toBe(todayBJ());
  });
});
