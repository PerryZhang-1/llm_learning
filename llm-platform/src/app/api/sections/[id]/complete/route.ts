import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { awardPoints } from "@/lib/points";
import { touchActivity } from "@/lib/streak";
import { checkBadgesAfterActivity, grantBadge } from "@/lib/badges";

/**
 * 小节完成上报（开发文档 §7.2 规则3/4）
 * 普通小节：停留时长 ≥ estimatedMinutes×60×30% → 记完成 +10
 * 代码实操小节：额外要求 codeBlocksExpanded=true → 记完成 +15（CODE_PRACTICE）
 * 未达停留时长：温和提示"不急，慢慢看～"，不计失败，可再次上报
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const { id } = await params;
  const section = await prisma.llmSection.findUnique({
    where: { id },
    include: { chapter: { include: { module: { select: { isOptional: true } } } } },
  });
  if (!section) {
    return NextResponse.json({ ok: false, message: "小节不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const dwellSeconds = Number(body.dwellSeconds) || 0;
  const minSeconds = Math.floor(section.estimatedMinutes * 60 * 0.3);
  if (dwellSeconds < minSeconds) {
    return NextResponse.json({
      ok: false,
      tooFast: true,
      message: "不急，慢慢看～ 读完再标记完成就好",
    });
  }

  // 代码实操小节：必须展开全部代码块（前端埋点上报）
  if (section.sectionType === "code_practice" && body.codeBlocksExpanded !== true) {
    return NextResponse.json({
      ok: false,
      message: "先把所有代码块展开看一遍，再标记完成哦",
    });
  }

  await prisma.userProgress.upsert({
    where: { userId_sectionId: { userId: user.id, sectionId: id } },
    update: { completed: true, completedAt: new Date() },
    create: { userId: user.id, sectionId: id, completed: true, completedAt: new Date() },
  });

  const pointType = section.sectionType === "code_practice" ? "CODE_PRACTICE" : "SECTION_DONE";
  const award = await awardPoints(user.id, pointType, id);
  await touchActivity(user.id);

  const newBadges = await checkBadgesAfterActivity(user.id);
  // 可选包探索勋章
  if (section.chapter.module.isOptional && (await grantBadge(user.id, "explorer_prep"))) {
    newBadges.push("explorer_prep");
  }

  return NextResponse.json({
    ok: true,
    awarded: award.awarded,
    points: award.points,
    newBadges,
  });
}
