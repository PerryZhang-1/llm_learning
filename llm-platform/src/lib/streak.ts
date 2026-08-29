import { prisma } from "./db";
import { todayBJ, addDaysBJ } from "./time";

/**
 * 连续学习更新（开发文档 §6.3 判定公式）
 * 触发时机：任意学习动作 + 打开总览页
 * 规则：当日重复活跃不重复计数；昨日活跃则续签；否则重置为 1（断签不打击）
 * streakBest 只升不降，永不回退
 */
export async function touchActivity(userId: string): Promise<void> {
  const today = todayBJ();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveDay: true, streakCurrent: true, streakBest: true },
  });
  if (!user || user.lastActiveDay === today) return;

  const yesterday = addDaysBJ(today, -1);
  // 23:59 学习、次日 00:01 再学习 → lastActiveDay == 昨日 → 计为连续（不断签）
  const streakCurrent =
    user.lastActiveDay === yesterday ? user.streakCurrent + 1 : 1;
  const streakBest = Math.max(user.streakBest, streakCurrent);

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveDay: today, streakCurrent, streakBest },
  });
}
