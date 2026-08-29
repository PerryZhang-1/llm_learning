/**
 * content 小节 Markdown 的唯一解析器（canonical parser）。
 * 格式规范见 content/README.md。
 *
 * check-frontfrontmatter.mjs / verify-content-migration.ts / 未来的 sync-content.ts
 * 一律复用本模块，严禁各自实现解析逻辑（防止格式漂移）。
 *
 * 支持的 YAML 子集（仅覆盖本仓库内容文件的写法，不是通用 YAML）：
 *   key: "字符串"     —— 双引号，仅转义 \" 和 \\
 *   key: true|false|null|整数
 *   key:              —— 下一行起 "  - \"项\"" 形式的列表
 */

const EXERCISES_HEADER = "## 随堂轻习题";
const SNIPPETS_HEADER = "## 可选代码片段";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseScalar(raw) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  const q = /^"(.*)"$/.exec(raw);
  if (q) return q[1].replace(/\\(["\\])/g, "$1");
  throw new Error(`无法解析的 frontmatter 标量值：${raw}`);
}

/** 解析 frontmatter，返回 { data, contentStart }（contentStart 为正文起始偏移） */
export function parseFrontmatter(mdRaw) {
  let md = mdRaw.replace(/\r\n/g, "\n"); // 统一换行（Windows 编辑器友好）
  if (md.charCodeAt(0) === 0xfeff) md = md.slice(1); // 兼容 UTF-8 BOM
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) throw new Error("缺少 frontmatter（文件必须以 --- 包裹的元数据块开头）");
  const data = {};
  const lines = m[1].split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const kv = /^([A-Za-z][A-Za-z0-9]*): ?(.*)$/.exec(line);
    if (!kv) throw new Error(`frontmatter 行无法解析：${line}`);
    if (kv[2] === "") {
      const items = [];
      i++;
      while (i < lines.length && lines[i].startsWith('  - "')) {
        items.push(parseScalar(lines[i].slice(3).trim()));
        i++;
      }
      data[kv[1]] = items;
    } else {
      data[kv[1]] = parseScalar(kv[2]);
      i++;
    }
  }
  return { data, contentStart: m[0].length };
}

/** 代码片段区：### 标题 + 围栏代码块（语言标注捕获到 lang，供 A 级运行器选择解释器） */
function parseSnippets(text) {
  const lines = text.split("\n");
  const out = [];
  let title = null;
  let lang = "";
  let inCode = false;
  let codeLines = [];
  for (const line of lines) {
    if (!inCode && line.startsWith("### ")) {
      if (title !== null) out.push({ title, lang, code: codeLines.join("\n") });
      title = line.slice(4).trim();
      lang = "";
      codeLines = [];
      continue;
    }
    if (!inCode && line.startsWith("```")) {
      inCode = true;
      lang = line.slice(3).trim().split(/\s+/)[0] ?? "";
      continue;
    }
    if (inCode && /^```\s*$/.test(line)) {
      inCode = false;
      out.push({ title, lang, code: codeLines.join("\n") });
      title = null;
      lang = "";
      codeLines = [];
      continue;
    }
    if (inCode) codeLines.push(line);
  }
  if (inCode || title !== null) throw new Error("代码片段区存在未闭合的标题或代码块");
  return out.length ? out : null;
}

/** 习题块：### Q<n> · <type> · <id> + 题干/选项/答案/解析/知识点 五个标签行 */
function parseExercises(text) {
  const stripped = text.replace(
    new RegExp(`^${escapeRegExp(EXERCISES_HEADER)}\\n`),
    ""
  );
  const parts = stripped.split(/^### /m);
  // 严格边界：标题与第一个习题块之间不允许有任何内容（防止正文被静默吞进习题区）
  if (parts[0].trim() !== "") {
    throw new Error("「随堂轻习题」标题与第一个习题块之间存在多余内容（疑似正文被截断）");
  }
  const blocks = parts.slice(1).map((s) => s.trim());
  if (blocks.length === 0) throw new Error("随堂轻习题区没有任何习题块");

  return blocks.map((block) => {
    const lines = block.split("\n");
    const head = /^Q(\d+) · (single|multi|judge) · (\S+)$/.exec(lines[0]);
    if (!head) throw new Error(`习题块头部格式错误（应为 "### Q<n> · <type> · <id>"）：${lines[0]}`);
    const fields = {};
    const options = [];
    let cur = null;
    for (const line of lines.slice(1)) {
      const f = /^(题干|选项|答案|解析|知识点)：(.*)$/.exec(line);
      if (f) {
        cur = f[1];
        if (cur === "选项" && f[2].trim() !== "") {
          // judge 题的选项为单行 "正确 / 错误"
          options.push(...f[2].split(" / "));
        } else {
          fields[cur] = f[2];
        }
        continue;
      }
      const opt = /^- ([A-Z])\. (.*)$/.exec(line);
      if (opt && cur === "选项") {
        options.push(opt[2]);
        continue;
      }
      if (line.trim() === "") continue;
      throw new Error(`习题 ${head[3]} 存在无法解析的行：${line}`);
    }
    for (const key of ["题干", "答案", "解析", "知识点"]) {
      if (!fields[key] || fields[key].trim() === "") {
        throw new Error(`习题 ${head[3]} 缺少「${key}：」字段`);
      }
    }
    if (options.length === 0) throw new Error(`习题 ${head[3]} 缺少选项`);
    return {
      order: parseInt(head[1], 10),
      type: head[2],
      id: head[3],
      question: fields["题干"],
      options,
      answerText: fields["答案"],
      explanation: fields["解析"],
      knowledgePoint: fields["知识点"],
    };
  });
}

/**
 * 解析整份小节文件。
 * 返回 { frontmatter, body, codeSnippets, exercises }；
 * exercises[].answer 仍为 Markdown 文本形态，用 answersFromMarkdown 转 DB 形态。
 */
export function parseSection(mdFile) {
  const md = mdFile.replace(/\r\n/g, "\n");
  const { data, contentStart } = parseFrontmatter(md);
  const content = md.slice(contentStart);

  const exIdx = content.split("\n").indexOf(EXERCISES_HEADER);
  if (exIdx < 0) throw new Error(`正文缺少「${EXERCISES_HEADER}」小节`);
  const beforeEx = content.split("\n").slice(0, exIdx).join("\n");
  const exercisesMd = content.split("\n").slice(exIdx).join("\n");

  let body = beforeEx;
  let codeSnippets = null;
  const snIdx = beforeEx.split("\n").indexOf(SNIPPETS_HEADER);
  if (snIdx >= 0) {
    body = beforeEx.split("\n").slice(0, snIdx).join("\n");
    codeSnippets = parseSnippets(
      beforeEx.split("\n").slice(snIdx + 1).join("\n")
    );
  }
  body = body.replace(/\n+$/, "").replace(/^\n+/, "");
  if (body === "") throw new Error("正文为空");

  return {
    frontmatter: data,
    body,
    codeSnippets,
    exercises: parseExercises(exercisesMd),
  };
}

/** Markdown 答案文本 → DB 形态（single: 数字下标 / multi: 下标数组 / judge: 布尔） */
export function answersFromMarkdown(type, answerText, options) {
  if (type === "judge") {
    if (answerText === "正确") return true;
    if (answerText === "错误") return false;
    throw new Error(`judge 题答案只能是「正确/错误」，实际为：${answerText}`);
  }
  const idx = answerText
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .map((L) => {
      const i = L.charCodeAt(0) - 65;
      if (Number.isNaN(i) || i < 0 || i >= options.length) {
        throw new Error(`答案 ${answerText} 中 ${L} 超出选项范围`);
      }
      return i;
    });
  if (idx.length === 0) throw new Error(`答案为空：${answerText}`);
  if (type === "single") {
    if (idx.length !== 1) throw new Error(`single 题答案只能有一个字母：${answerText}`);
    return idx[0];
  }
  if (new Set(idx).size !== idx.length) throw new Error(`multi 题答案有重复字母：${answerText}`);
  return idx;
}

/** DB 答案形态 → Markdown 答案文本 */
export function answerToMarkdown(type, answer) {
  if (type === "judge") return answer ? "正确" : "错误";
  const arr = type === "single" ? [answer] : answer;
  return arr.map((i) => String.fromCharCode(65 + i)).join(",");
}

/** frontmatter 标量/列表的序列化辅助（供生成器与同步脚本共用，保证可被 parseFrontmatter 读回） */
export function fmQuote(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 知识块派生（QA 检索用）：按二级标题切块，chunk = 小节标题 + 块正文。
 * 切分规则的全局唯一权威——sync-content / verify-content-migration 一律复用，
 * 生产嵌入管线（R3）也必须沿用同一规则，避免"入库切块"与"检索切块"不一致。
 */
export function deriveChunks(title, bodyMarkdown) {
  return bodyMarkdown
    .split(/\n## /)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `${title}\n${b}`);
}
