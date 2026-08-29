import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** 错题本：未征服的优先展示，附知识点标签便于回看 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const items = await prisma.wrongBook.findMany({
    where: { userId: user.id },
    include: {
      exercise: {
        select: {
          id: true,
          question: true,
          type: true,
          options: true,
          explanation: true,
          knowledgePoint: true,
          sectionId: true,
          section: { select: { title: true } },
        },
      },
    },
    orderBy: { conquered: "asc" },
  });

  return NextResponse.json({
    ok: true,
    items: items.map((w) => ({
      exerciseId: w.exerciseId,
      attempts: w.attempts,
      lastResult: w.lastResult,
      conquered: w.conquered,
      sectionId: w.exercise.sectionId,
      sectionTitle: w.exercise.section.title,
      question: w.exercise.question,
      type: w.exercise.type,
      options: JSON.parse(w.exercise.options),
      explanation: w.exercise.explanation,
      knowledgePoint: w.exercise.knowledgePoint,
    })),
  });
}
