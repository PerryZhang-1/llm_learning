/**
 * 内容同步脚本（Task R1-2；SPEC-content §5.2 步骤④）
 * content/（唯一事实源）→ 解析 → 五集合 + KnowledgeChunk 全量重灌。
 *
 * 语义（对齐任务验收标准）：
 * - 单事务先删后插：任一步失败整体回滚，数据库保持原状
 * - 幂等：同一 content/ 重复执行，数据库逻辑状态一致
 * - 旧向量零残留：KnowledgeChunk 先全删再重建
 * - 稳定 id：moduleCode/chapterCode/sectionId/习题 id 全部沿用 content/ 的 id，
 *   UserProgress / WrongBook / Feedback / PointsLog.refId 的历史引用不受影响
 *
 * 安全阀：
 * - 预检失败（字段检查不过 / 重复 id / 目录引用缺失 / 用户数据将成为孤儿）→ 中止，不碰数据库
 * - --dry-run 只输出同步计划，不写库
 * - --dir <path> 允许对 content/ 的任意副本执行（测试/演练用）
 *
 * 用法：npx tsx scripts/sync-content.ts [--dry-run] [--dir <path>]
 * 注意：tsx 以 CJS 加载 .ts，顶层不支持 await——所有异步逻辑必须在 main() 内。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  answersFromMarkdown,
  deriveChunks,
  parseSection,
} from "../../content/scripts/parse-section.mjs";
import { embedModelName, embedTexts, embeddingsEnabled } from "../src/lib/embeddings";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const dirArg = argv.indexOf("--dir");
const CONTENT_DIR = dirArg >= 0 ? resolve(argv[dirArg + 1]) : join(ROOT, "content");

for (const line of readFileSync(join(ROOT, "llm-platform", ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const MODULE_CODES = new Set(["prep", "core_principle", "app", "engineering"]);
const DIFFICULTIES = new Set(["prep", "core", "advanced"]);

interface CatalogModule {
  id: string; code: string; name: string; description: string; isOptional: boolean; order: number;
}
interface CatalogChapter {
  code: string; moduleCode: string; name: string; order: number;
}
interface Catalog {
  modules: CatalogModule[]; chapters: CatalogChapter[];
}

function fail(msg: string): never {
  console.error(`\n✗ 同步中止：${msg}`);
  process.exit(1);
}

function walkMd(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkMd(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

interface IncomingExercise {
  id: string; sectionId: string; question: string; type: string;
  optionsJson: string; answerJson: string; explanation: string; knowledgePoint: string; order: number;
}
interface IncomingSection {
  id: string; chapterCode: string; title: string; sectionType: string;
  estimatedMinutes: number; bodyMarkdown: string; codeSnippetsJson: string | null;
  version: string; sourceRefsJson: string; codeVerified: boolean; order: number;
  chunks: string[]; exercises: IncomingExercise[];
}

// ---------- 1. 预检：字段完整性（复用 check-frontmatter.mjs，避免规则双份漂移） ----------
console.log(`同步目标：${CONTENT_DIR}${DRY_RUN ? "（--dry-run，不写库）" : ""}\n`);

const checkerPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/scripts/check-frontmatter.mjs");
const check = spawnSync(process.execPath, [checkerPath, join(CONTENT_DIR, "modules")], { stdio: "inherit" });
if (check.status !== 0) fail("字段完整性检查未通过（上方 ✗ 项），请先修复 content/ 再同步");

const lintPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/scripts/content-lint.mjs");
const lint = spawnSync(process.execPath, [lintPath, "--dir", CONTENT_DIR], { stdio: "inherit" });
if (lint.status !== 0) fail("内容静态检查未通过（规则 4/6/8/9 + 代码分级静态项），请先修复 content/ 再同步");
// 注：sync 不做 --run-code（A 级代码以 CI 运行结果为准，见规则 3-A）；此处为静态纵深防御

// ---------- 2. 预检：解析与跨文件/目录一致性 ----------
const catalog = JSON.parse(readFileSync(join(CONTENT_DIR, "catalog.json"), "utf8")) as Catalog;
const problems: string[] = [];

const moduleCodes = new Set<string>();
const moduleIds = new Set<string>();
for (const m of catalog.modules) {
  if (moduleCodes.has(m.code)) problems.push(`catalog：模块 code 重复：${m.code}`);
  if (moduleIds.has(m.id)) problems.push(`catalog：模块 id 重复：${m.id}`);
  if (!MODULE_CODES.has(m.code)) problems.push(`catalog：moduleCode 非法：${m.code}`);
  moduleCodes.add(m.code);
  moduleIds.add(m.id);
}
const chapterByCode = new Map<string, CatalogChapter>();
for (const c of catalog.chapters) {
  if (chapterByCode.has(c.code)) problems.push(`catalog：章节 code 重复：${c.code}`);
  if (!moduleCodes.has(c.moduleCode)) problems.push(`catalog：章节 ${c.code} 引用了不存在的模块 ${c.moduleCode}`);
  chapterByCode.set(c.code, c);
}

const mdFiles = walkMd(join(CONTENT_DIR, "modules"));
if (mdFiles.length === 0) fail("modules/ 下没有任何 .md 小节文件");

const sections: IncomingSection[] = [];
const sectionIds = new Set<string>();
const exerciseIds = new Map<string, string>(); // 习题 id -> 所属小节 id

for (const file of mdFiles) {
  const rel = relative(CONTENT_DIR, file);
  let parsed;
  try {
    parsed = parseSection(readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${rel}：解析失败：${(e as Error).message}`);
    continue;
  }
  const fm = parsed.frontmatter;

  if (sectionIds.has(fm.sectionId)) problems.push(`${rel}：sectionId 重复：${fm.sectionId}`);
  sectionIds.add(fm.sectionId);
  if (!chapterByCode.has(fm.chapterCode)) {
    problems.push(`${rel}：chapterCode ${fm.chapterCode} 不在 catalog.json 中`);
  }
  if (!DIFFICULTIES.has(fm.difficulty)) problems.push(`${rel}：difficulty 非法：${fm.difficulty}`);

  const exercises: IncomingExercise[] = [];
  for (const ex of parsed.exercises) {
    if (exerciseIds.has(ex.id)) {
      problems.push(`${rel}：习题 id 重复：${ex.id}（另见 ${exerciseIds.get(ex.id)}）`);
      continue;
    }
    exerciseIds.set(ex.id, fm.sectionId);
    let answerJson: unknown;
    try {
      answerJson = answersFromMarkdown(ex.type, ex.answerText, ex.options);
    } catch (e) {
      problems.push(`${rel}/${ex.id}：${(e as Error).message}`);
      continue;
    }
    exercises.push({
      id: ex.id, sectionId: fm.sectionId, question: ex.question, type: ex.type,
      optionsJson: JSON.stringify(ex.options), answerJson: JSON.stringify(answerJson),
      explanation: ex.explanation, knowledgePoint: ex.knowledgePoint, order: ex.order,
    });
  }

  // 知识块切分：规则唯一权威在 parse-section.mjs 的 deriveChunks
  sections.push({
    id: fm.sectionId, chapterCode: fm.chapterCode, title: fm.title,
    sectionType: fm.sectionType, estimatedMinutes: fm.estimatedMinutes,
    bodyMarkdown: parsed.body,
    codeSnippetsJson: parsed.codeSnippets
      ? JSON.stringify(parsed.codeSnippets.map(({ title, code }) => ({ title, code })))
      : null,
    version: fm.version, sourceRefsJson: JSON.stringify(fm.sources ?? []),
    codeVerified: Boolean(fm.codeVerified), order: fm.order,
    chunks: deriveChunks(fm.title, parsed.body),
    exercises,
  });
}

if (problems.length > 0) {
  console.error("");
  for (const p of problems) console.error(`  ✗ ${p}`);
  fail(`解析/一致性预检发现 ${problems.length} 个问题`);
}

// ---------- 3~5. 孤儿引用预检 → 同步计划 → 单事务全量重灌 ----------
const prisma = new PrismaClient();

async function preflightUserRefs() {
  const orphanFeedbacks = await prisma.feedback.findMany({
    where: { sectionId: { notIn: [...sectionIds] } },
    select: { id: true, sectionId: true },
  });
  const orphanWrongBooks = await prisma.wrongBook.findMany({
    where: { exerciseId: { notIn: [...exerciseIds.keys()] } },
    select: { id: true, exerciseId: true },
  });
  if (orphanFeedbacks.length > 0 || orphanWrongBooks.length > 0) {
    console.error("");
    for (const f of orphanFeedbacks) console.error(`  ✗ 反馈 ${f.id} 引用了将被移除的小节 ${f.sectionId}`);
    for (const w of orphanWrongBooks) console.error(`  ✗ 错题本 ${w.id} 引用了将被移除的习题 ${w.exerciseId}`);
    fail("同步会导致用户数据（反馈/错题本）成为孤儿引用；请先处理内容或清理对应引用后再试");
  }
}

const totalExercises = sections.reduce((n, s) => n + s.exercises.length, 0);
const totalChunks = sections.reduce((n, s) => n + s.chunks.length, 0);

async function main() {
  await preflightUserRefs();

  console.log(`\n同步计划：${catalog.modules.length} 模块 / ${catalog.chapters.length} 章节 / ${sections.length} 小节 / ${totalExercises} 习题 / ${totalChunks} 知识块`);

  if (DRY_RUN) {
    for (const s of sections) {
      console.log(`  · [${s.order}] ${s.id}（${s.chapterCode}，${s.sectionType}，${s.exercises.length} 题，${s.chunks.length} 块）`);
    }
    console.log("\n--dry-run 结束，数据库未改动");
    return;
  }

  const started = Date.now();
  const counts = await prisma.$transaction(
    async (tx) => {
      // 用户数据搬移策略（跨数据库通用，不依赖方言魔法）：
      // 错题本/反馈带真实外键，先整表搬出，内容重灌（id 不变）后原样放回。
      // UserProgress/PointsLog 引用的是字符串 id（无 FK），不受影响。
      const savedWrong = await tx.wrongBook.findMany();
      const savedFeedback = await tx.feedback.findMany();
      await tx.wrongBook.deleteMany();
      await tx.feedback.deleteMany();

      await tx.knowledgeChunk.deleteMany();
      await tx.llmExercise.deleteMany();
      await tx.llmSection.deleteMany();
      await tx.llmChapter.deleteMany();
      await tx.llmModule.deleteMany();

      for (const m of catalog.modules) {
        await tx.llmModule.create({
          data: { id: m.id, code: m.code, name: m.name, description: m.description, isOptional: m.isOptional, order: m.order },
        });
      }
      for (const c of catalog.chapters) {
        const mod = catalog.modules.find((m) => m.code === c.moduleCode)!;
        await tx.llmChapter.create({ data: { id: c.code, moduleId: mod.id, name: c.name, order: c.order } });
      }
      for (const s of sections) {
        await tx.llmSection.create({
          data: {
            id: s.id, chapterId: s.chapterCode, title: s.title, sectionType: s.sectionType,
            estimatedMinutes: s.estimatedMinutes, bodyMarkdown: s.bodyMarkdown,
            codeSnippets: s.codeSnippetsJson, version: s.version,
            sourceRefs: s.sourceRefsJson, codeVerified: s.codeVerified, order: s.order,
          },
        });
        for (const ex of s.exercises) {
          await tx.llmExercise.create({
            data: {
              id: ex.id, sectionId: ex.sectionId, question: ex.question, type: ex.type,
              options: ex.optionsJson, answer: ex.answerJson, explanation: ex.explanation,
              knowledgePoint: ex.knowledgePoint, order: ex.order,
            },
          });
        }
        for (const [ci, body] of s.chunks.entries()) {
          await tx.knowledgeChunk.create({
            // 确定性 id：同步幂等（快照字节级一致）+ 幻觉事故可稳定归因（§10.4）
            data: { id: `chk-${s.id}-${ci + 1}`, sectionId: s.id, body, version: s.version, embeddingModel: "none" },
          });
        }
      }

      // 用户数据原样放回（id 一并保留）
      for (const w of savedWrong) {
        await tx.wrongBook.create({
          data: {
            id: w.id, userId: w.userId, exerciseId: w.exerciseId,
            attempts: w.attempts, lastResult: w.lastResult, conquered: w.conquered,
          },
        });
      }
      for (const f of savedFeedback) {
        await tx.feedback.create({
          data: {
            id: f.id, userId: f.userId, sectionId: f.sectionId,
            content: f.content, status: f.status, createdAt: f.createdAt,
          },
        });
      }

      return { sections: sections.length, exercises: totalExercises, chunks: totalChunks };
    },
    { timeout: 60_000 }
  );

  console.log(`\n✅ 同步完成（${Date.now() - started}ms）：重灌 ${counts.sections} 小节 / ${counts.exercises} 习题 / ${counts.chunks} 知识块；模块与章节按 catalog 重建`);

  // ---------- 嵌入生成（R3）：有 DASHSCOPE_API_KEY 时为知识块写入 pgvector 向量 ----------
  if (embeddingsEnabled()) {
    const pending = await prisma.knowledgeChunk.findMany({
      where: { embeddingModel: "none" },
      orderBy: { id: "asc" },
    });
    const vecs = await embedTexts(pending.map((c) => c.body));
    if (vecs) {
      for (let i = 0; i < pending.length; i++) {
        await prisma.knowledgeChunk.update({
          where: { id: pending[i].id },
          data: {
            embedding: Buffer.from(Float32Array.from(vecs[i]).buffer),
            embeddingModel: embedModelName(),
          },
        });
      }
      console.log(`嵌入完成：${pending.length} 个知识块（${embedModelName()}，1024 维）`);
    } else {
      console.log("⚠ 嵌入生成未成功，知识块保持关键词检索降级（答疑功能不受影响）");
    }
  } else {
    console.log("未配置 DASHSCOPE_API_KEY，知识块保持关键词检索降级");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
