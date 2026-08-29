#!/usr/bin/env node
/**
 * 前端文案扫描（R4-6；DESIGN.md 文案规范硬约束）。
 *
 * 扫描 llm-platform/src/**\/*.ts,tsx 的用户可见文案：
 *  - JUDGMENT_TERMS / JUDGMENT_PATTERNS / CAUTION_TERMS 全部按 error 处理
 *    （UI 字符串没有"技术语境豁免"——DESIGN.md 第四节：UI 按全量档执行；
 *     content/ 的教学正文才使用 CAUTION warning 档，那是 content-lint 的职责）
 *  - 注释行（//、*、/* 开头）跳过，只查字符串与 JSX 文本
 *
 * 词表唯一权威：content/scripts/copy-rules.mjs
 * 退出码：0 = 通过；1 = 存在违规
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { JUDGMENT_TERMS, JUDGMENT_PATTERNS, CAUTION_TERMS } = await import(
  pathToFileURL(
    join(dirname(fileURLToPath(import.meta.url)), "../../content/scripts/copy-rules.mjs")
  ).href
);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** 去掉注释：整行注释 + 行尾注释（URL 的 // 前面是冒号，不受影响）。
 *  先统一换行——JS 正则的 . 不匹配 \r，CRLF 文件会让行尾注释剥离失配。 */
function stripComments(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .map((line) => line.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

let violations = 0;
const files = walk(SRC);
for (const file of files) {
  const shown = relative(process.cwd(), file);
  const text = stripComments(readFileSync(file, "utf8"));
  const checks = [
    [...JUDGMENT_TERMS.map((t) => [t, `评判/施压词「${t}」`]),
     ...CAUTION_TERMS.map((t) => [t, `施压/否定词「${t}」`])]
      .flatMap(([t, label]) => (text.includes(t) ? [[label]] : [])),
    JUDGMENT_PATTERNS.filter((re) => re.test(text)).map((re) => [`攀比表述「${re.exec(text)[0]}」`]),
  ].flat();

  for (const [label] of checks) {
    violations++;
    console.error(`  ✗ ${shown}：${label}（§8.4：UI 文案全量档，改用温和替代表述）`);
  }
}

console.log(`\n文案扫描完成：${files.length} 个文件，${violations} 处违规`);
process.exit(violations > 0 ? 1 : 0);
