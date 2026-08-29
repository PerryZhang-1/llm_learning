import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { awardPoints } from "@/lib/points";
import { grantBadge } from "@/lib/badges";

/**
 * 习题提交（开发文档 §7.2 规则6/7）
 * 无限重做、不惩罚；对错均返回解析；答错写错题本；同题每日首次提交计 1 次分
 * 判分：single=精确匹配；multi=集合相等（少选/多选/错选均错）；judge=布尔匹配
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const { id } = await params;
  const exercise = await prisma.llmExercise.findUnique({ where: { id } });
  if (!exercise) {
    return NextResponse.json({ ok: false, message: "习题不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const correct = judge(exercise.type, exercise.answer, body.answer);

  // 错题本：答错入库；重做答对 → conquered 置 true（永不回退）
  let conqueredNow = false;
  const existing = await prisma.wrongBook.findUnique({
    where: { userId_exerciseId: { userId: user.id, exerciseId: id } },
  });
  if (!correct) {
    await prisma.wrongBook.upsert({
      where: { userId_exerciseId: { userId: user.id, exerciseId: id } },
      update: { attempts: { increment: 1 }, lastResult: false },
      create: { userId: user.id, exerciseId: id, attempts: 1, lastResult: false },
    });
  } else if (existing && !existing.lastResult) {
    conqueredNow = true;
    await prisma.wrongBook.update({
      where: { userId_exerciseId: { userId: user.id, exerciseId: id } },
      data: { attempts: { increment: 1 }, lastResult: true, conquered: true },
    });
  }

  const award = await awardPoints(user.id, "EXERCISE_SUBMIT", id);

  let newBadge: string | null = null;
  if (conqueredNow && (await grantBadge(user.id, "wrong_conqueror"))) {
    newBadge = "wrong_conqueror";
  }

  return NextResponse.json({
    ok: true,
    correct,
    explanation: exercise.explanation, // 对错均展示解析
    knowledgePoint: exercise.knowledgePoint,
    awarded: award.awarded,
    points: award.points,
    newBadge,
    message: correct ? "答对了，继续保持这个节奏～" : "没关系，看懂解析再做一次就好",
  });
}

function judge(type: string, answerJson: string, userAnswer: unknown): boolean {
  try {
    const expected = JSON.parse(answerJson);
    if (type === "multi") {
      if (!Array.isArray(userAnswer)) return false;
      const a = new Set(userAnswer.map(String));
      const b = new Set((expected as string[]).map(String));
      return a.size === b.size && [...a].every((x) => b.has(x));
    }
    if (type === "judge") return Boolean(userAnswer) === Boolean(expected);
    return String(userAnswer) === String(expected); // single
  } catch {
    return false;
  }
}
