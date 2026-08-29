import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * 可选包开关（开发文档 §7.1：仅改展示标志，不动进度）
 * 同时是"推荐路径之外"的温和入口：开关不影响任何已完成记录
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { prepPackOn?: boolean; advPackOn?: boolean } = {};
  if (typeof body.prepPackOn === "boolean") data.prepPackOn = body.prepPackOn;
  if (typeof body.advPackOn === "boolean") data.advPackOn = body.advPackOn;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, message: "无有效参数" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { prepPackOn: true, advPackOn: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
