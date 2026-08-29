import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * 获取小节内容 + 习题（答案仅服务端持有，前端不返回）
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const section = await prisma.llmSection.findUnique({
    where: { id },
    include: {
      chapter: { select: { name: true, module: { select: { name: true } } } },
      exercises: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          question: true,
          type: true,
          options: true,
          knowledgePoint: true,
        },
      },
    },
  });
  if (!section) {
    return NextResponse.json({ ok: false, message: "小节不存在" }, { status: 404 });
  }

  const user = await getCurrentUser();
  let completed = false;
  if (user) {
    const progress = await prisma.userProgress.findUnique({
      where: { userId_sectionId: { userId: user.id, sectionId: id } },
    });
    completed = progress?.completed ?? false;
  }

  return NextResponse.json({
    ok: true,
    section: {
      id: section.id,
      title: section.title,
      bodyMarkdown: section.bodyMarkdown,
      codeSnippets: section.codeSnippets ? JSON.parse(section.codeSnippets) : [],
      sectionType: section.sectionType,
      estimatedMinutes: section.estimatedMinutes,
      version: section.version,
      sourceRefs: JSON.parse(section.sourceRefs || "[]"),
      chapterName: section.chapter.name,
      moduleName: section.chapter.module.name,
      completed,
      exercises: section.exercises.map((e) => ({
        ...e,
        options: JSON.parse(e.options),
      })),
    },
  });
}
