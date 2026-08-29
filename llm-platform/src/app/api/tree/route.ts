import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * 知识树（模块 → 章节 → 小节），含当前用户完成状态
 * 可选包（预习/高阶）随用户开关过滤展示标志
 */
export async function GET() {
  const user = await getCurrentUser();

  const modules = await prisma.llmModule.findMany({
    orderBy: { order: "asc" },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              sectionType: true,
              estimatedMinutes: true,
            },
          },
        },
      },
    },
  });

  let completedSet = new Set<string>();
  if (user) {
    const done = await prisma.userProgress.findMany({
      where: { userId: user.id, completed: true },
      select: { sectionId: true },
    });
    completedSet = new Set(done.map((d) => d.sectionId));
  }

  return NextResponse.json({
    ok: true,
    packs: { prepPackOn: user?.prepPackOn ?? false, advPackOn: user?.advPackOn ?? false },
    modules: modules.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      description: m.description,
      isOptional: m.isOptional,
      chapters: m.chapters.map((c) => ({
        id: c.id,
        name: c.name,
        sections: c.sections.map((s) => ({
          ...s,
          completed: completedSet.has(s.id),
        })),
      })),
    })),
  });
}
