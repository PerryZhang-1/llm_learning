import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminEmail } from "@/lib/session";
import { awardPoints } from "@/lib/points";
import { grantBadge } from "@/lib/badges";

/**
 * 管理端：反馈状态流转（§7.1：open → accepted → fixed；或 rejected）
 * accepted 时发 +5 分并授予"反馈达人"勋章（幂等：同一条反馈只发一次）
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin || !isAdminEmail(admin.email)) {
    return NextResponse.json({ ok: false, message: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!["accepted", "fixed", "rejected"].includes(status)) {
    return NextResponse.json({ ok: false, message: "无效状态" }, { status: 400 });
  }

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) {
    return NextResponse.json({ ok: false, message: "反馈不存在" }, { status: 404 });
  }

  // 只允许合法流转：open → accepted/rejected；accepted → fixed
  const allowed: Record<string, string[]> = {
    open: ["accepted", "rejected"],
    accepted: ["fixed"],
  };
  if (!(allowed[feedback.status] ?? []).includes(status)) {
    return NextResponse.json(
      { ok: false, message: `不允许从 ${feedback.status} 流转到 ${status}` },
      { status: 400 }
    );
  }

  await prisma.feedback.update({ where: { id }, data: { status } });

  let award = null;
  if (status === "accepted") {
    // refId = feedbackId：同一条反馈只发一次分
    award = await awardPoints(feedback.userId, "FEEDBACK", feedback.id);
    if (award.awarded) await grantBadge(feedback.userId, "feedback_hero");
  }

  return NextResponse.json({ ok: true, awarded: award?.awarded ?? false });
}
