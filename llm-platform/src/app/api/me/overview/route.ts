import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { touchActivity } from "@/lib/streak";

/**
 * 学习总览（老用户首页直达；打开即触发连续学习续签 §6.3）
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  await touchActivity(user.id);

  const [sections, progress, fresh] = await Promise.all([
    prisma.llmSection.findMany({
      select: { id: true, chapterId: true, chapter: { select: { moduleId: true } } },
    }),
    prisma.userProgress.findMany({
      where: { userId: user.id, completed: true },
      select: { sectionId: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { streakCurrent: true, points: true }, // touchActivity 后的最新值
    }),
  ]);

  const doneSet = new Set(progress.map((p) => p.sectionId));
  const sectionModule = new Map(sections.map((s) => [s.id, s.chapter.moduleId]));

  // 按推荐路径模块顺序找第一个未完成小节
  const pathCodes: string[] = user.assessment
    ? (JSON.parse(user.assessment).recommendedPath ?? [])
    : [];
  const modules = await prisma.llmModule.findMany({ select: { id: true, code: true } });
  const codeToId = new Map(modules.map((m) => [m.code, m.id]));

  let nextSectionId: string | null = null;
  for (const code of pathCodes) {
    const moduleId = codeToId.get(code);
    if (!moduleId) continue;
    const candidate = sections.find(
      (s) => s.chapter.moduleId === moduleId && !doneSet.has(s.id)
    );
    if (candidate) {
      nextSectionId = candidate.id;
      break;
    }
  }
  if (!nextSectionId) {
    nextSectionId = sections.find((s) => !doneSet.has(s.id))?.id ?? null;
  }
  void sectionModule;

  return NextResponse.json({
    ok: true,
    nickname: user.nickname,
    points: fresh?.points ?? user.points,
    streakCurrent: fresh?.streakCurrent ?? user.streakCurrent,
    streakBest: user.streakBest,
    qaRemainToday: user.qaRemainToday,
    completedCount: progress.length,
    totalCount: sections.length,
    percent: sections.length
      ? Math.round((progress.length / sections.length) * 100)
      : 0,
    nextSectionId,
    hasAssessment: Boolean(user.assessment),
    assessmentSummary: user.assessment
      ? (JSON.parse(user.assessment).summary ?? "")
      : null,
  });
}
