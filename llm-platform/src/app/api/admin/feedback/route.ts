import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminEmail } from "@/lib/session";

/** 管理端：反馈列表（仅管理员） */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ ok: false, message: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // open | accepted | fixed | rejected

  const items = await prisma.feedback.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { nickname: true, email: true } },
      section: { select: { title: true } },
    },
  });
  return NextResponse.json({ ok: true, items });
}
