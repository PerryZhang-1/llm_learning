import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { consumeQaQuota } from "@/lib/qa-quota";
import { answerQuestion } from "@/lib/qa";

/**
 * AI 答疑（开发文档 §10.1 管线）
 * ① 限流检查（惰性重置，余量 ≤0 温和拦截，不调用 LLM）
 * ② 检索 + 生成（携带小节上下文）
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ ok: false, message: "请输入你的问题" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ ok: false, message: "问题太长了，精简一下再问吧" }, { status: 400 });
  }

  const quota = await consumeQaQuota(user.id);
  if (!quota.ok) {
    return NextResponse.json({
      ok: false,
      limited: true,
      message: "今天的答疑次数用完啦，明天再来～ 先把错题本和解析用起来也很好",
    });
  }

  const sectionId = typeof body.sectionId === "string" ? body.sectionId : undefined;
  const result = await answerQuestion(question, sectionId);

  return NextResponse.json({
    ok: true,
    ...result,
    remainToday: quota.remain,
  });
}
