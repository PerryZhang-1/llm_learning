import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * 内容 BUG 反馈提交（§7.2：提交不直接发分，管理端确认有效后才 +5，防垃圾刷分）
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";
  if (!content || content.length < 10) {
    return NextResponse.json(
      { ok: false, message: "请至少写 10 个字，方便我们定位问题～" },
      { status: 400 }
    );
  }
  if (content.length > 1000) {
    return NextResponse.json({ ok: false, message: "反馈内容太长了" }, { status: 400 });
  }
  const section = await prisma.llmSection.findUnique({ where: { id: sectionId } });
  if (!section) {
    return NextResponse.json({ ok: false, message: "小节不存在" }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: { userId: user.id, sectionId, content },
  });

  return NextResponse.json({
    ok: true,
    id: feedback.id,
    message: "收到！我们会尽快核实，确认有效会给你加分答谢～",
  });
}

/** 我的反馈记录（状态可见，闭环感） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const items = await prisma.feedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { section: { select: { title: true } } },
  });
  return NextResponse.json({ ok: true, items });
}
