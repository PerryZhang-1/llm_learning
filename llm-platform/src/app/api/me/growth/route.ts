import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { BADGES } from "@/lib/badges";

/** 成长数据：积分、连续学习、勋章、统计 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const [earned, completedSections, totalSections, wrongTotal, conqueredTotal] =
    await Promise.all([
      prisma.userBadge.findMany({ where: { userId: user.id } }),
      prisma.userProgress.count({ where: { userId: user.id, completed: true } }),
      prisma.llmSection.count(),
      prisma.wrongBook.count({ where: { userId: user.id, lastResult: false } }),
      prisma.wrongBook.count({ where: { userId: user.id, conquered: true } }),
    ]);

  const earnedCodes = new Set(earned.map((b) => b.badgeCode));

  return NextResponse.json({
    ok: true,
    points: user.points,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    completedSections,
    totalSections,
    wrongTotal,
    conqueredTotal,
    badges: BADGES.map((b) => ({
      ...b,
      earned: earnedCodes.has(b.code),
      earnedAt: earned.find((e) => e.badgeCode === b.code)?.earnedAt ?? null,
    })),
  });
}
