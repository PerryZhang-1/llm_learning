/**
 * 迁移保真校验（Task R1-1 验收测试，2026-08-28）：
 * 以数据库为事实源，把 content/ 下的 Markdown 逐字段回写比对——
 * 正文逐字、代码片段、习题题干/选项/答案/解析/知识点/顺序、全部 frontmatter 元数据。
 * 任何不一致都视为迁移事故，退出码 1。
 *
 * 未来 sync-content.ts（Task R1-2）可实现为「写入前先跑本比对逻辑」。
 *
 * 用法：npx tsx scripts/verify-content-migration.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  answersFromMarkdown,
  deriveChunks,
  parseSection,
} from "../../content/scripts/parse-section.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONTENT_MODULES_DIR = join(ROOT, "content", "modules");

for (const line of readFileSync(join(ROOT, "llm-platform", ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

function walkMd(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkMd(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const problems: string[] = [];
function problem(msg: string) {
  problems.push(msg);
  console.error(`  ✗ ${msg}`);
}

const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.llmSection.findMany({
    orderBy: { order: "asc" },
    include: {
      chapter: { include: { module: true } },
      exercises: { orderBy: { order: "asc" } },
    },
  });

  const mdFiles = walkMd(CONTENT_MODULES_DIR);
  console.log(`数据库小节 ${sections.length} 个，Markdown 文件 ${mdFiles.length} 个\n`);
  if (sections.length !== mdFiles.length) {
    problem(`数量不一致：DB ${sections.length} vs MD ${mdFiles.length}`);
  }

  const consumedMd = new Set<string>();

  for (const s of sections) {
    const label = `${s.chapter.module.code}/${s.chapter.id}/${s.id}`;
    console.log(`比对 ${label}`);
    const file = join(CONTENT_MODULES_DIR, s.chapter.module.code, s.chapter.id, `${s.id}.md`);
    if (!existsSync(file)) {
      problem(`${label}：缺少 Markdown 文件 ${file}`);
      continue;
    }
    consumedMd.add(file);

    let parsed;
    try {
      parsed = parseSection(readFileSync(file, "utf8"));
    } catch (e) {
      problem(`${label}：Markdown 解析失败：${(e as Error).message}`);
      continue;
    }
    const fm = parsed.frontmatter;

    // ---- frontmatter 元数据 ----
    const expect: Array<[string, unknown, unknown]> = [
      ["sectionId", fm.sectionId, s.id],
      ["title", fm.title, s.title],
      ["moduleCode", fm.moduleCode, s.chapter.module.code],
      ["chapterCode", fm.chapterCode, s.chapter.id],
      ["sectionType", fm.sectionType, s.sectionType],
      ["estimatedMinutes", fm.estimatedMinutes, s.estimatedMinutes],
      ["version", fm.version, s.version],
      ["codeVerified", fm.codeVerified, s.codeVerified],
      ["order", fm.order, s.order],
      ["reviewedBy", fm.reviewedBy, "pending"],
      ["lastReviewedAt", fm.lastReviewedAt, null],
    ];
    for (const [key, actual, want] of expect) {
      if (actual !== want) problem(`${label}：frontmatter.${key} 不一致（MD=${JSON.stringify(actual)} DB=${JSON.stringify(want)}）`);
    }
    const sources = JSON.parse(s.sourceRefs) as string[];
    if (JSON.stringify(fm.sources) !== JSON.stringify(sources)) {
      problem(`${label}：sources 不一致（MD=${JSON.stringify(fm.sources)} DB=${JSON.stringify(sources)}）`);
    }

    // ---- 正文逐字 ----
    if (parsed.body !== s.bodyMarkdown) {
      problem(`${label}：正文与 DB 不一致\n    MD  首 80 字：${JSON.stringify(parsed.body.slice(0, 80))}\n    DB   首 80 字：${JSON.stringify(s.bodyMarkdown.slice(0, 80))}`);
    }

    // ---- 代码片段（lang 仅为运行器所用，不入库；两侧 null 必须显式归一，JSON.stringify(null)="null"）----
    const mdSnippets = parsed.codeSnippets
      ? JSON.stringify(parsed.codeSnippets.map(({ title, code }) => ({ title, code })))
      : null;
    const dbSnippets = s.codeSnippets ? JSON.stringify(JSON.parse(s.codeSnippets)) : null;
    if (mdSnippets !== dbSnippets) {
      problem(`${label}：codeSnippets 不一致（MD=${mdSnippets} DB=${dbSnippets}）`);
    }

    // ---- 习题逐字段 ----
    if (parsed.exercises.length !== s.exercises.length) {
      problem(`${label}：习题数量不一致（MD=${parsed.exercises.length} DB=${s.exercises.length}）`);
    }
    const dbExById = new Map(s.exercises.map((e) => [e.id, e]));
    for (const ex of parsed.exercises) {
      const db = dbExById.get(ex.id);
      if (!db) {
        problem(`${label}：MD 中的习题 ${ex.id} 在 DB 中不存在`);
        continue;
      }
      const cmp: Array<[string, unknown, unknown]> = [
        ["question", ex.question, db.question],
        ["type", ex.type, db.type],
        ["explanation", ex.explanation, db.explanation],
        ["knowledgePoint", ex.knowledgePoint, db.knowledgePoint],
        ["order", ex.order, db.order],
      ];
      for (const [key, actual, want] of cmp) {
        if (actual !== want) problem(`${label}/${ex.id}：${key} 不一致（MD=${JSON.stringify(actual)} DB=${JSON.stringify(want)}）`);
      }
      const options = JSON.parse(db.options) as string[];
      if (JSON.stringify(ex.options) !== JSON.stringify(options)) {
        problem(`${label}/${ex.id}：options 不一致（MD=${JSON.stringify(ex.options)} DB=${JSON.stringify(options)}）`);
      }
      try {
        const answer = answersFromMarkdown(ex.type, ex.answerText, ex.options);
        const dbAnswer = JSON.parse(db.answer);
        if (JSON.stringify(answer) !== JSON.stringify(dbAnswer)) {
          problem(`${label}/${ex.id}：answer 不一致（MD 还原=${JSON.stringify(answer)} DB=${JSON.stringify(dbAnswer)}）`);
        }
      } catch (e) {
        problem(`${label}/${ex.id}：答案还原失败：${(e as Error).message}`);
      }
    }
    for (const [id] of dbExById) {
      if (!parsed.exercises.some((e) => e.id === id)) {
        problem(`${label}：DB 习题 ${id} 在 MD 中缺失`);
      }
    }

    // ---- 知识块派生一致性（切块规则唯一权威：parse-section.mjs deriveChunks）----
    const chunkCount = await prisma.knowledgeChunk.count({ where: { sectionId: s.id } });
    const derived = deriveChunks(s.title, s.bodyMarkdown).length;
    if (chunkCount !== derived) {
      problem(`${label}：知识块数量不一致（DB=${chunkCount} 正文切分=${derived}）`);
    }
  }

  for (const f of mdFiles) {
    if (!consumedMd.has(f)) problem(`多余的 Markdown 文件（DB 中无对应小节）：${f}`);
  }

  console.log(`\n${problems.length === 0 ? "✅ 迁移保真校验全部通过" : `❌ 发现 ${problems.length} 处不一致`}`);
  process.exit(problems.length === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
