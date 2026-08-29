#!/usr/bin/env node
/**
 * content 小节文件字段完整性检查（Task R1-1 的验收工具，后续并入 CI）。
 *
 * 用法：node content/scripts/check-frontmatter.mjs [contentDir]
 *   contentDir 缺省为本仓库的 content/modules（由脚本位置推导）。
 * 传目录参数即可对任意副本/夹具运行（对抗性测试用）。
 *
 * 退出码：0 = 全部通过；1 = 存在错误。
 * 分层报错：frontmatter 层与正文/习题层各自独立校验、互不遮蔽——
 * 一类解析失败不会掩盖同文件其他类错误。
 * 解析逻辑全部来自 parse-section.mjs（唯一解析器），本脚本只做规则校验。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFrontmatter,
  parseSection,
  answersFromMarkdown,
} from "./parse-section.mjs";

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "modules");
const targetDir = process.argv[2] ? process.argv[2] : DEFAULT_DIR;

const MODULE_CODES = new Set(["prep", "core_principle", "app", "engineering"]);
const DIFFICULTIES = new Set(["prep", "core", "advanced"]);
const SECTION_TYPES = new Set(["normal", "code_practice"]);
const REQUIRED_KEYS = [
  "sectionId", "title", "moduleCode", "chapterCode", "difficulty",
  "sectionType", "estimatedMinutes", "version", "sources",
  "codeVerified", "reviewedBy", "lastReviewedAt", "order", "codeLevel",
];
const CODE_LEVELS = new Set(["A", "B", "C", "none"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = statSync(targetDir).isDirectory() ? walk(targetDir) : [targetDir];
if (files.length === 0) {
  console.error(`错误：${targetDir} 下没有找到 .md 文件`);
  process.exit(1);
}

const seenSectionIds = new Map();
const seenExerciseIds = new Map();
let errorCount = 0;

function err(file, msg) {
  errorCount++;
  console.error(`  ✗ ${relative(process.cwd(), file) || file}：${msg}`);
}

for (const file of files) {
  const shown = relative(process.cwd(), file) || file;
  console.log(`检查 ${shown}`);
  const raw = readFileSync(file, "utf8");

  // ---------- 层 1：frontmatter 字段 ----------
  let fm = null;
  try {
    fm = parseFrontmatter(raw).data;
  } catch (e) {
    err(file, `frontmatter 解析失败：${e.message}`);
  }

  if (fm) {
    if (seenSectionIds.has(fm.sectionId)) {
      err(file, `sectionId 重复：${fm.sectionId}（另见 ${seenSectionIds.get(fm.sectionId)}）`);
    } else {
      seenSectionIds.set(fm.sectionId, shown);
    }

    for (const key of REQUIRED_KEYS) {
      if (!(key in fm)) err(file, `frontmatter 缺少字段 ${key}`);
    }
    if (fm.sectionId !== undefined && !/^sec-[a-z0-9][a-z0-9-]*$/.test(fm.sectionId)) {
      err(file, `sectionId 非法（应为 sec- 前缀小写连字符）：${fm.sectionId}`);
    }
    if (fm.chapterCode !== undefined && !/^ch-[a-z0-9][a-z0-9-]*$/.test(fm.chapterCode)) {
      err(file, `chapterCode 非法（应为 ch- 前缀小写连字符）：${fm.chapterCode}`);
    }
    if (fm.moduleCode !== undefined && !MODULE_CODES.has(fm.moduleCode)) {
      err(file, `moduleCode 非法（${[...MODULE_CODES].join(" | ")}）：${fm.moduleCode}`);
    }
    if (fm.difficulty !== undefined && !DIFFICULTIES.has(fm.difficulty)) {
      err(file, `difficulty 非法（${[...DIFFICULTIES].join(" | ")}）：${fm.difficulty}`);
    }
    if (fm.sectionType !== undefined && !SECTION_TYPES.has(fm.sectionType)) {
      err(file, `sectionType 非法（${[...SECTION_TYPES].join(" | ")}）：${fm.sectionType}`);
    }
    if (fm.estimatedMinutes !== undefined) {
      const n = fm.estimatedMinutes;
      if (!Number.isInteger(n) || n < 5 || n > 10) {
        err(file, `estimatedMinutes 必须是 5–10 的整数：${n}`);
      }
    }
    if (fm.version !== undefined && !/^\d{4}-\d{2}$/.test(fm.version)) {
      err(file, `version 格式应为 YYYY-MM：${fm.version}`);
    }
    if (fm.order !== undefined && (!Number.isInteger(fm.order) || fm.order < 1)) {
      err(file, `order 必须是正整数：${fm.order}`);
    }
    if (fm.sources !== undefined) {
      if (!Array.isArray(fm.sources) || fm.sources.length === 0 || fm.sources.some((s) => typeof s !== "string" || s.trim() === "")) {
        err(file, "sources 必须是非空字符串数组（≥1 项）");
      }
    }
    if (typeof fm.title !== "string" || fm.title.trim() === "") err(file, "title 不能为空");

    // 诚实性规则：pending 审核不得带终审日期；已终审必须带日期
    if (fm.reviewedBy === "pending" && fm.lastReviewedAt !== null) {
      err(file, "reviewedBy=pending 时 lastReviewedAt 必须为 null（不得伪造终审记录）");
    }
    if (fm.reviewedBy !== undefined && fm.reviewedBy !== "pending") {
      if (typeof fm.lastReviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fm.lastReviewedAt)) {
        err(file, `已终审（reviewedBy=${fm.reviewedBy}）必须填写 lastReviewedAt（YYYY-MM-DD）`);
      }
    }

    // 路径与 frontmatter 一致：<dir>/modules/<moduleCode>/<chapterCode>/<sectionId>.md
    const rel = relative(targetDir, file);
    const expected = join(fm.moduleCode ?? "?", fm.chapterCode ?? "?", `${fm.sectionId ?? "?"}.md`);
    if (rel !== expected) {
      err(file, `路径与 frontmatter 不一致：应为 modules/${expected.replaceAll(sep, "/")}，实际 modules/${rel.replaceAll(sep, "/")}`);
    }

    // 规则 3 代码分级（开发文档 §5.1）：A=CI 必跑 / B=AutoDL 日志 / C=静态 / none=无代码或纯示意
    if (fm.codeLevel !== undefined && !CODE_LEVELS.has(fm.codeLevel)) {
      err(file, `codeLevel 非法（${[...CODE_LEVELS].join(" | ")}）：${fm.codeLevel}`);
    }
    if (fm.codeLevel === "B") {
      const logPath = fm.verificationLog;
      if (typeof logPath !== "string" || !/^verification\/[a-z0-9][a-z0-9.-]*\.log$/.test(logPath)) {
        err(file, "codeLevel=B 必须提供 verificationLog（verification/<sectionId>.log）");
      } else {
        const abs = resolve(dirname(targetDir), logPath);
        if (!existsSync(abs)) err(file, `B 级验证日志不存在：${logPath}`);
        else if (statSync(abs).size === 0) err(file, `B 级验证日志为空：${logPath}`);
      }
    }
    if (fm.codeLevel === "A" && fm.codeVerified !== true) {
      err(file, "codeLevel=A 要求 codeVerified=true（A 级以 CI 运行通过为准）");
    }
  }

  // ---------- 层 2：正文与习题 ----------
  let parsed = null;
  try {
    parsed = parseSection(raw);
  } catch (e) {
    err(file, `正文/习题解析失败：${e.message}`);
  }

  if (parsed) {
    if (/^## (随堂轻习题|可选代码片段)$/m.test(parsed.body)) {
      err(file, "正文 body 中不得出现保留小节标题（随堂轻习题/可选代码片段）");
    }

    if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      err(file, "至少需要 1 道随堂习题");
    } else if (parsed.exercises.length > 4) {
      err(file, `随堂习题最多 4 道（§4.3：2–4 道），实际 ${parsed.exercises.length}`);
    }
    for (const ex of parsed.exercises) {
      if (!/^ex-[a-z0-9][a-z0-9-]*$/.test(ex.id)) {
        err(file, `习题 id 非法（应为 ex- 前缀小写连字符）：${ex.id}`);
      }
      if (seenExerciseIds.has(ex.id)) {
        err(file, `习题 id 重复：${ex.id}（另见 ${seenExerciseIds.get(ex.id)}）`);
      } else {
        seenExerciseIds.set(ex.id, shown);
      }
      try {
        answersFromMarkdown(ex.type, ex.answerText, ex.options);
      } catch (e) {
        err(file, `习题 ${ex.id}：${e.message}`);
      }
      if (ex.type === "single" || ex.type === "multi") {
        if (ex.options.length < 2) err(file, `习题 ${ex.id}：至少 2 个选项`);
        if (new Set(ex.options).size !== ex.options.length) err(file, `习题 ${ex.id}：选项不得重复`);
      }
      if (ex.type === "multi") {
        if (ex.answerText.split(",").length < 2) err(file, `习题 ${ex.id}：multi 题答案至少 2 项`);
      }
      if (ex.type === "judge") {
        if (ex.options.length !== 2 || ex.options[0] !== "正确" || ex.options[1] !== "错误") {
          err(file, `习题 ${ex.id}：judge 题选项固定为「正确 / 错误」`);
        }
      }
      if (ex.explanation.includes("\n")) err(file, `习题 ${ex.id}：解析须单行`);
    }
  }
}

console.log(`\n共检查 ${files.length} 个文件，发现 ${errorCount} 个错误`);
process.exit(errorCount > 0 ? 1 : 0);
