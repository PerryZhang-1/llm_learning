/**
 * 一次性迁移脚本（2026-08-28，Task R1-1）：
 * 把开发档 seed 产生的 7 个小节从 SQLite 逐字段生成 §4.3 模板的 Markdown，
 * 落到 monorepo 子目录 content/modules/<moduleCode>/<chapterCode>/<sectionId>.md。
 *
 * 事实源是数据库（dev.db 由 prisma/seed.ts 生成），正文与习题逐字保真，不做人工转抄。
 * 诚实性约束：迁移批次的 reviewedBy 一律为 "pending"，绝不伪造人工终审记录；
 * codeVerified 沿用 DB 值（seed 标记样例内容已过静态检查）。
 *
 * 用法：npx tsx scripts/migrate-seed-to-content.ts [--force]
 *   默认已存在的目标文件会跳过（防止覆盖人工编辑）；--force 才允许覆盖。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { answerToMarkdown, fmQuote } from "../../content/scripts/parse-section.mjs";

const FORCE = process.argv.includes("--force");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONTENT_MODULES_DIR = join(ROOT, "content", "modules");

// 迷你 .env 加载（独立脚本不经过 Next.js，需自行注入 DATABASE_URL）
for (const line of readFileSync(join(ROOT, "llm-platform", ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// 模块 → 难度映射（difficulty 是 frontmatter 新增字段，DB 无此列，映射规则记录在 content/README.md）
const DIFFICULTY_BY_MODULE: Record<string, string> = {
  prep: "prep",
  core_principle: "core",
  app: "core",
  engineering: "advanced",
};

function renderExercise(ex: {
  order: number; type: string; id: string; question: string;
  options: string; answer: string; explanation: string; knowledgePoint: string;
}, type: string): string {
  const options = JSON.parse(ex.options) as string[];
  const answerJson = JSON.parse(ex.answer) as unknown;
  const lines: string[] = [];
  lines.push(`### Q${ex.order} · ${type} · ${ex.id}`);
  lines.push(`题干：${ex.question}`);
  if (type === "judge") {
    lines.push(`选项：${options.join(" / ")}`);
  } else {
    lines.push("选项：");
    options.forEach((opt, i) => lines.push(`- ${String.fromCharCode(65 + i)}. ${opt}`));
  }
  lines.push(`答案：${answerToMarkdown(type, answerJson)}`);
  lines.push(`解析：${ex.explanation}`);
  lines.push(`知识点：${ex.knowledgePoint}`);
  return lines.join("\n");
}

function renderSection(s: {
  id: string; title: string; sectionType: string; estimatedMinutes: number;
  bodyMarkdown: string; codeSnippets: string | null; version: string;
  sourceRefs: string; codeVerified: boolean; order: number;
  chapter: { id: string; module: { code: string } };
}, exercises: Array<Parameters<typeof renderExercise>[0]>): string {
  const sources = JSON.parse(s.sourceRefs) as string[];
  const out: string[] = [];
  out.push("---");
  out.push(`sectionId: ${fmQuote(s.id)}`);
  out.push(`title: ${fmQuote(s.title)}`);
  out.push(`moduleCode: ${fmQuote(s.chapter.module.code)}`);
  out.push(`chapterCode: ${fmQuote(s.chapter.id)}`);
  out.push(`difficulty: ${fmQuote(DIFFICULTY_BY_MODULE[s.chapter.module.code] ?? "core")}`);
  out.push(`sectionType: ${fmQuote(s.sectionType)}`);
  out.push(`estimatedMinutes: ${s.estimatedMinutes}`);
  out.push(`version: ${fmQuote(s.version)}`);
  out.push("sources:");
  for (const src of sources) out.push(`  - ${fmQuote(src)}`);
  out.push(`codeVerified: ${s.codeVerified}`);
  out.push('codeLevel: "none"'); // 迁移批次：样例片段为示意代码，不承诺可运行（规则 3 分级）
  out.push('reviewedBy: "pending"');
  out.push("lastReviewedAt: null");
  out.push(`order: ${s.order}`);
  out.push("---");
  out.push("");
  out.push(s.bodyMarkdown);
  out.push("");

  const snippets = s.codeSnippets
    ? (JSON.parse(s.codeSnippets) as { title: string; code: string }[])
    : null;
  if (snippets && snippets.length > 0) {
    out.push("## 可选代码片段");
    out.push("");
    for (const sn of snippets) {
      out.push(`### ${sn.title}`);
      out.push("");
      out.push("```python");
      out.push(sn.code.replace(/\n$/, ""));
      out.push("```");
      out.push("");
    }
  }

  out.push("## 随堂轻习题");
  out.push("");
  for (const ex of exercises) {
    out.push(renderExercise(ex, ex.type));
    out.push("");
  }
  return out.join("\n");
}

const prisma = new PrismaClient();

async function main() {
  const [modules, chapters, sections] = await Promise.all([
    prisma.llmModule.findMany({ orderBy: { order: "asc" } }),
    prisma.llmChapter.findMany({ orderBy: { order: "asc" } }),
    prisma.llmSection.findMany({
      orderBy: { order: "asc" },
      include: { chapter: { include: { module: true } }, exercises: { orderBy: { order: "asc" } } },
    }),
  ]);
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const chaptersWithType = chapters.map((c) => ({
    ...c,
    module: moduleById.get(c.moduleId) as { code: string },
  }));

  let written = 0;
  let skipped = 0;
  for (const s of sections) {
    const chapter = chaptersWithType.find((c) => c.id === s.chapterId);
    if (!chapter || !chapter.module) throw new Error(`小节 ${s.id} 的章节链断裂：${s.chapterId}`);
    const dir = join(CONTENT_MODULES_DIR, chapter.module.code, chapter.id);
    const file = join(dir, `${s.id}.md`);
    const md = renderSection(
      { ...s, chapter: { id: chapter.id, module: { code: chapter.module.code } } },
      s.exercises
    );
    if (existsSync(file) && !FORCE) {
      console.log(`跳过（已存在，如需覆盖加 --force）：${file}`);
      skipped++;
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, md, "utf8");
    written++;
    console.log(`生成：${file}`);
  }
  console.log(`\n完成：写入 ${written} 个，跳过 ${skipped} 个（共 ${sections.length} 个小节）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
