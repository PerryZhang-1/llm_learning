import { prisma } from "./db";
import { todayBJ } from "./time";

/**
 * 积分引擎（开发文档 §9.1 + §7.2 规则1/2）
 * 铁律：只增不减——所有 delta 恒为正，不存在扣分代码路径
 * 防刷：唯一约束幂等（同用户+同类型+同对象+同日仅计一次）+ 每日分源封顶
 */

export type PointType =
  | "SECTION_DONE"
  | "EXERCISE_SUBMIT"
  | "CODE_PRACTICE"
  | "FEEDBACK";

export const POINT_VALUES: Record<PointType, number> = {
  SECTION_DONE: 10,
  EXERCISE_SUBMIT: 5,
  CODE_PRACTICE: 15,
  FEEDBACK: 5,
};

// 每日封顶（§9.1）：超出部分动作仍正常记录进度/错题本，仅不计分
const DAILY_SOURCE_CAPS: Partial<Record<PointType, number>> = {
  EXERCISE_SUBMIT: 30,
  FEEDBACK: 15,
};
const DAILY_TOTAL_CAP = 200;

export interface AwardResult {
  awarded: boolean;
  points: number;
  reason?: "ok" | "already_awarded" | "daily_source_cap" | "daily_total_cap";
}

export async function awardPoints(
  userId: string,
  type: PointType,
  refId: string
): Promise<AwardResult> {
  const delta = POINT_VALUES[type];
  if (!(delta > 0)) throw new Error("points delta must be positive"); // 公理级硬校验
  const dayKey = todayBJ();

  return prisma.$transaction(async (tx) => {
    // 1. 幂等检查：唯一约束 (userId, type, refId, dayKey)
    const existing = await tx.pointsLog.findUnique({
      where: { userId_type_refId_dayKey: { userId, type, refId, dayKey } },
    });
    if (existing) return { awarded: false, points: 0, reason: "already_awarded" };

    // 2. 分源封顶
    const sourceCap = DAILY_SOURCE_CAPS[type];
    if (sourceCap !== undefined) {
      const cap = await tx.dailyPointCap.upsert({
        where: { userId_dayKey_source: { userId, dayKey, source: type } },
        update: {},
        create: { userId, dayKey, source: type, points: 0 },
      });
      if (cap.points + delta > sourceCap)
        return { awarded: false, points: 0, reason: "daily_source_cap" };
      await tx.dailyPointCap.update({
        where: { userId_dayKey_source: { userId, dayKey, source: type } },
        data: { points: cap.points + delta },
      });
    }

    // 3. 每日总量封顶
    const total = await tx.dailyPointCap.upsert({
      where: { userId_dayKey_source: { userId, dayKey, source: "TOTAL" } },
      update: {},
      create: { userId, dayKey, source: "TOTAL", points: 0 },
    });
    if (total.points + delta > DAILY_TOTAL_CAP)
      return { awarded: false, points: 0, reason: "daily_total_cap" };
    await tx.dailyPointCap.update({
      where: { userId_dayKey_source: { userId, dayKey, source: "TOTAL" } },
      data: { points: total.points + delta },
    });

    // 4. 记录流水 + 加积分（单事务内，防并发双倍计分）
    await tx.pointsLog.create({ data: { userId, dayKey, delta, type, refId } });
    await tx.user.update({
      where: { id: userId },
      data: { points: { increment: delta } },
    });
    return { awarded: true, points: delta, reason: "ok" };
  });
}
