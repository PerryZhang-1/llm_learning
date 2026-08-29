import { prisma } from "./db";

/**
 * 徽章引擎（开发文档 §9.2）
 * 铁律：勋章一旦获得永不回收——只有 upsert，不存在 delete 路径
 */

export interface BadgeDef {
  code: string;
  name: string;
  category: "progress" | "behavior" | "explore"; // 进度类/行为类/探索类
  desc: string;
}

export const BADGES: BadgeDef[] = [
  { code: "first_step", name: "启程者", category: "progress", desc: "完成第一个学习小节" },
  { code: "chapter_done", name: "章节探索家", category: "progress", desc: "完成任意一个完整章节" },
  { code: "streak_3", name: "三日同行", category: "behavior", desc: "连续学习 3 天" },
  { code: "streak_7", name: "七日同行", category: "behavior", desc: "连续学习 7 天" },
  { code: "streak_30", name: "月度深耕", category: "behavior", desc: "连续学习 30 天" },
  { code: "explorer_prep", name: "好奇心", category: "explore", desc: "完成一个可选包小节" },
  { code: "feedback_hero", name: "反馈达人", category: "explore", desc: "反馈被确认有效" },
  { code: "wrong_conqueror", name: "错题征服者", category: "explore", desc: "把做错的题重做答对" },
];

/** 幂等授予勋章：已拥有则静默跳过（永不重复、永不回收） */
export async function grantBadge(userId: string, badgeCode: string): Promise<boolean> {
  try {
    await prisma.userBadge.create({ data: { userId, badgeCode } });
    return true;
  } catch {
    return false; // 唯一约束冲突 = 已拥有
  }
}

/** 通用事件检查：学习动作后调用 */
export async function checkBadgesAfterActivity(userId: string): Promise<string[]> {
  const earned: string[] = [];

  const [completedCount, streak, user] = await Promise.all([
    prisma.userProgress.count({ where: { userId, completed: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakCurrent: true, streakBest: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { prepPackOn: true } }),
  ]);

  if (completedCount >= 1 && (await grantBadge(userId, "first_step"))) earned.push("first_step");

  // 连续学习勋章：用 streakCurrent 或 streakBest 任一达标即永久获得（断签不剥夺）
  const best = Math.max(streak?.streakCurrent ?? 0, streak?.streakBest ?? 0);
  if (best >= 3 && (await grantBadge(userId, "streak_3"))) earned.push("streak_3");
  if (best >= 7 && (await grantBadge(userId, "streak_7"))) earned.push("streak_7");
  if (best >= 30 && (await grantBadge(userId, "streak_30"))) earned.push("streak_30");

  // 章节完成检查：任一章节的全部小节完成
  const chapters = await prisma.llmChapter.findMany({
    include: { sections: { select: { id: true } } },
  });
  if (chapters.length > 0) {
    const doneSet = new Set(
      (
        await prisma.userProgress.findMany({
          where: { userId, completed: true },
          select: { sectionId: true },
        })
      ).map((p) => p.sectionId)
    );
    const anyChapterDone = chapters.some(
      (c) => c.sections.length > 0 && c.sections.every((s) => doneSet.has(s.id))
    );
    if (anyChapterDone && (await grantBadge(userId, "chapter_done"))) earned.push("chapter_done");
  }

  void user; // 预留：探索类勋章的更多判定
  return earned;
}
