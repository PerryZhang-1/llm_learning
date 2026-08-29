#!/usr/bin/env node
/**
 * 内容静态检查（Task R1-3；开发文档 §5.1 规则 3/4/6/8/9 的自动化部分）。
 *
 * 规则覆盖：
 *  - 规则 4（无营销水文）：MARKETING_TERMS 扫描 → error
 *  - 规则 6（无越界内容）：OUT_OF_SCOPE_TERMS（CV/无关领域）→ error
 *  - 规则 8（阅读时长 5–10 分钟，超出即拆分）：字数估时 → 体量超限 error、
 *    宣称时长与体量严重不符 error（校准常数见 ESTIMATE 常量处注释）
 *  - 规则 9（文案合规）：JUDGMENT_TERMS → error；CAUTION_TERMS（错误/失败/必须）→ warning
 *    （分层理由见 copy-rules.mjs 文件头；前端 UI 字符串扫描应把 CAUTION 升格为 error）
 *  - 规则 3（代码分级验证）：
 *      A 级 → CI 必须实际运行（--run-code），仅支持标准库，超时 10s，exit 0
 *      B 级 → 必须存在非空 AutoDL 验证日志（verificationLog 指向 content/verification/*.log）
 *      C 级 → 静态检查：敏感信息、未锁版本的安装命令、curl|bash
 *    所有代码块（含正文内嵌围栏）均做敏感信息扫描。
 *
 * 用法：node content/scripts/content-lint.mjs [--dir <contentDir>] [--run-code]
 *   --dir 默认为本仓库 content/；--run-code 在静态检查之外实际执行 A 级代码块。
 * 退出码：0 = 无 error（warning 不拦截）；1 = 存在 error。
 * 解析逻辑全部来自 parse-section.mjs（唯一解析器）。
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSection } from "./parse-section.mjs";
import {
  CAUTION_TERMS,
  JUDGMENT_PATTERNS,
  JUDGMENT_TERMS,
  MARKETING_TERMS,
  OUT_OF_SCOPE_TERMS,
} from "./copy-rules.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(SCRIPT_DIR, "..");
const argv = process.argv.slice(2);
const RUN_CODE = argv.includes("--run-code");
const dirArg = argv.indexOf("--dir");
const CONTENT_DIR = dirArg >= 0 ? resolve(argv[dirArg + 1]) : DEFAULT_DIR;
const MODULES_DIR = join(CONTENT_DIR, "modules");

let errorCount = 0;
let warnCount = 0;
function err(file, msg) {
  errorCount++;
  console.error(`  ✗ ${file}：${msg}`);
}
function warn(file, msg) {
  warnCount++;
  console.warn(`  ⚠ ${file}：${msg}`);
}

function walkMd(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkMd(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

/** 文本扫描：JUDGMENT/OUT_OF_SCOPE/MARKETING → error；CAUTION → warning */
function scanTerms(file, field, text) {
  if (!text) return;
  for (const t of JUDGMENT_TERMS) {
    if (text.includes(t)) err(file, `${field}出现评判/施压词「${t}」（§8.4，改用温和替代表述）`);
  }
  for (const re of JUDGMENT_PATTERNS) {
    if (re.test(text)) err(file, `${field}出现攀比/排名表述「${re.exec(text)[0]}」`);
  }
  for (const t of OUT_OF_SCOPE_TERMS) {
    if (text.includes(t)) err(file, `${field}出现越界内容「${t}」（规则 6：对照永久剔除清单）`);
  }
  for (const t of MARKETING_TERMS) {
    if (text.includes(t)) err(file, `${field}出现营销/引流词「${t}」（规则 4：无营销水文）`);
  }
  for (const t of CAUTION_TERMS) {
    if (text.includes(t)) warn(file, `${field}含「${t}」——请人工确认是否为打击式表述（技术语境可保留）`);
  }
}

/** 规则 3 静态项之敏感信息（高精度模式，散文/代码通扫：密钥泄在哪儿都危险） */
function scanSecrets(file, field, text) {
  if (!text) return;
  const secrets = [
    [/sk-[A-Za-z0-9]{20,}/, "OpenAI 风格密钥"],
    [/AKIA[0-9A-Z]{16}/, "AWS AccessKey"],
    [/gh[pousr]_[A-Za-z0-9]{30,}/, "GitHub Token"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack Token"],
    [/(api[_-]?key|apikey)\s*[:=]\s*["'][^"']{8,}["']/i, "API Key 字面量"],
    [/(password|passwd|secret)\s*[:=]\s*["'][^"']{4,}["']/i, "口令字面量"],
    [/Bearer\s+[A-Za-z0-9._-]{20,}/, "Bearer Token"],
  ];
  for (const [re, name] of secrets) {
    if (re.test(text)) err(file, `${field}疑似泄露${name}（规则 3：无敏感信息）`);
  }
}

/** 规则 3 静态项之安装命令（代码块内 error；散文提及 warning——教学文本合法引用命令） */
function scanInstalls(file, field, code, prose) {
  for (const m of code.matchAll(/pip3?\s+install\s+([^#\\\n]+)/g)) {
    const pkgs = m[1].trim().split(/\s+/).filter((p) => /^[a-zA-Z0-9_.-]+$/.test(p));
    const unpinned = pkgs.filter((p) => !/[=<>~]/.test(p) && p !== "." && p !== "-r" && !p.startsWith("-") && !/\.(txt|yml|yaml|cfg)$/.test(p));
    if (unpinned.length > 0) {
      const msg = `pip 安装未锁定版本：${unpinned.join(", ")}（C 级静态项：版本锁定）`;
      prose ? warn(file, `${field}${msg}`) : err(file, `${field}${msg}`);
    }
  }
  for (const m of code.matchAll(/npm\s+install\s+([^#\\\n]+)/g)) {
    const pkgs = m[1].trim().split(/\s+/).filter((p) => /^[a-zA-Z@][a-zA-Z0-9@/._-]*$/.test(p) && !p.startsWith("-"));
    const unpinned = pkgs.filter((p) => !p.includes("@") || /^@[^/]+$/.test(p));
    if (unpinned.length > 0) {
      const msg = `npm 安装未锁定版本：${unpinned.join(", ")}（C 级静态项：版本锁定）`;
      prose ? warn(file, `${field}${msg}`) : err(file, `${field}${msg}`);
    }
  }
  if (/curl[^|]*\|\s*(ba)?sh/.test(code)) err(file, `${field}存在 curl|bash 模式（规则 3：禁止未审远程脚本）`);
}

/**
 * 规则 8 估时：CJK 220 字/分（学习材料精读速度）+ 英文词 150 词/分 + 代码 900 字符/分。
 * 校准基准：现有 7 节样例的估时均 ≤ 宣称值；阈值仅拦截"明显过长"（>12 分钟拆分）
 * 与"宣称时长严重不足"（估时 > 宣称 × 1.8）。
 */
function estimateMinutes(body) {
  const prose = body.replace(/```[\s\S]*?```/g, " ");
  const cjk = (prose.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (prose.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_.-]+/g) || []).length;
  const codeChars = [...body.matchAll(/```[\s\S]*?```/g)].reduce((n, m) => n + m[0].length, 0);
  return cjk / 220 + words / 150 + codeChars / 900;
}

// ---------- 规则 3 运行器 ----------
function findPython() {
  const candidates = [
    ["python3", ["--version"]],
    ["python", ["--version"]],
    ["py", ["-3", "--version"]],
  ];
  for (const [cmd, ...args] of candidates) {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    if (r.status === 0) return cmd === "py" ? ["py", "-3"] : [cmd];
  }
  return null;
}

function runSnippet(snippet, label) {
  const dir = mkdtempSync(join(tmpdir(), "content-lint-"));
  try {
    let cmd;
    const file = join(dir, "snippet");
    const lang = (snippet.lang || "").toLowerCase();
    if (["javascript", "js", "node"].includes(lang)) {
      writeFileSync(file + ".cjs", snippet.code);
      cmd = [process.execPath, file + ".cjs"];
    } else if (["python", "py"].includes(lang)) {
      const py = findPython();
      if (!py) {
        err(label, "未找到 Python 解释器（CI 已安装；本地请安装 Python 或改用 js 代码块）");
        return;
      }
      writeFileSync(file + ".py", snippet.code);
      cmd = [...py, file + ".py"];
    } else {
      err(label, `A 级代码块必须标注语言（支持 python / js），当前为「${snippet.lang || "（无）"}」`);
      return;
    }
    const r = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8", timeout: 10_000 });
    if (r.error && r.error.killed) {
      err(label, "运行超时（>10s）");
    } else if (r.status !== 0) {
      const tail = (r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" | ").slice(0, 200);
      if (/ModuleNotFoundError|Cannot find module/i.test(tail)) {
        err(label, "依赖第三方库（MVP A 级仅支持标准库；需依赖请降为 B 级并附 AutoDL 验证日志）");
      } else {
        err(label, `运行失败（exit=${r.status}）${tail ? "：" + tail : ""}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- 主流程 ----------
const mdFiles = walkMd(MODULES_DIR);
if (mdFiles.length === 0) {
  console.error(`✗ ${MODULES_DIR} 下没有 .md 文件`);
  process.exit(1);
}

for (const file of mdFiles) {
  const shown = relative(CONTENT_DIR, file).replaceAll("\\", "/");
  console.log(`检查 ${shown}`);
  let parsed;
  try {
    parsed = parseSection(readFileSync(file, "utf8"));
  } catch (e) {
    err(shown, `解析失败：${e.message}`);
    continue;
  }
  const fm = parsed.frontmatter;

  // 规则 9 + 4 + 6：标题与正文
  scanTerms(shown, "标题", fm.title);
  scanTerms(shown, "正文", parsed.body);

  // 规则 8：阅读时长
  const est = estimateMinutes(parsed.body);
  if (est > 12) err(shown, `规则 8：估时 ${est.toFixed(1)} 分钟超过 12 分钟上限，超出即拆分`);
  const claimed = Number(fm.estimatedMinutes);
  if (Number.isFinite(claimed) && est > claimed * 1.8) {
    err(shown, `规则 8：估时 ${est.toFixed(1)} 分钟 >> 宣称 ${claimed} 分钟（体量与宣称严重不符）`);
  }

  // 规则 9/4/6：习题文案（用户直接可见 → 全量词表）
  for (const ex of parsed.exercises) {
    scanTerms(shown, `习题 ${ex.id} 题干`, ex.question);
    scanTerms(shown, `习题 ${ex.id} 解析`, ex.explanation);
  }

  // 规则 3：敏感信息（散文+代码通扫）与安装命令（代码 error / 散文 warning）
  scanSecrets(shown, "正文", parsed.body);
  for (const ex of parsed.exercises) {
    scanSecrets(shown, `习题 ${ex.id} 解析`, ex.explanation);
  }
  scanInstalls(shown, "正文", parsed.body, true);
  const bodyFences = [...parsed.body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const [i, code] of bodyFences.entries()) {
    scanSecrets(shown, `正文代码块 #${i + 1}`, code);
    scanInstalls(shown, `正文代码块 #${i + 1}`, code, false);
  }
  for (const sn of parsed.codeSnippets ?? []) {
    scanSecrets(shown, `代码片段「${sn.title}」`, sn.code);
    scanInstalls(shown, `代码片段「${sn.title}」`, sn.code, false);
  }

  // 规则 3 分级
  const level = fm.codeLevel ?? "none";
  const snippets = parsed.codeSnippets ?? [];
  if (level === "A") {
    if (snippets.length === 0) err(shown, "规则 3-A：codeLevel=A 但没有任何代码片段");
    if (RUN_CODE) {
      for (const sn of snippets) runSnippet(sn, `${shown} 片段「${sn.title}」`);
    }
  } else if (level === "B") {
    const logPath = typeof fm.verificationLog === "string" ? fm.verificationLog : "";
    if (!/^verification\/[a-z0-9][a-z0-9.-]*\.log$/.test(logPath)) {
      err(shown, "规则 3-B：codeLevel=B 必须提供 verificationLog（verification/<sectionId>.log）");
    } else {
      const abs = resolve(CONTENT_DIR, logPath);
      if (!existsSync(abs)) err(shown, `规则 3-B：AutoDL 验证日志不存在：${logPath}`);
      else if (statSync(abs).size === 0) err(shown, `规则 3-B：验证日志为空：${logPath}`);
    }
  }
}

// ---------- catalog.json 文案扫描（模块/章节名与描述同样用户可见） ----------
const catalogPath = join(CONTENT_DIR, "catalog.json");
if (existsSync(catalogPath)) {
  console.log("检查 catalog.json");
  try {
    const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    for (const m of catalog.modules ?? []) {
      scanTerms("catalog.json", `模块 ${m.code} 描述`, m.description);
    }
    for (const c of catalog.chapters ?? []) {
      scanTerms("catalog.json", `章节 ${c.code} 名称`, c.name);
    }
  } catch (e) {
    err("catalog.json", `解析失败：${e.message}`);
  }
}

console.log(`\n静态检查完成：${errorCount} 个 error / ${warnCount} 个 warning`);
if (RUN_CODE) console.log("（A 级代码块已实际运行）");
process.exit(errorCount > 0 ? 1 : 0);
