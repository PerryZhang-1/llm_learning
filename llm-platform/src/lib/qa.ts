import { prisma } from "./db";
import { embedModelName, embedTexts, embeddingsEnabled } from "./embeddings";

/**
 * AI 答疑（开发文档 §10，生产档 R3）
 * 检索：内存余弦（余弦距离 ≤ 0.35，即相似度 ≥ 0.65）；无嵌入/无 key 降级关键词匹配
 * 生成：DashScope OpenAI 兼容端点（LLM_MODEL = qwen3.7-plus）
 * 上下文预算：注入总量 ≤ 4K tokens（按字符近似预算：小节全文 2500 字 + 知识块合计 1800 字）
 * 降级链：无 LLM key → 返回检索片段；检索为空 → 坦诚告知
 */

const SIMILARITY_THRESHOLD_DISTANCE = 0.35; // 余弦距离阈值 = 1 - 0.65（§10.4 初始阈值）
const SECTION_CONTEXT_MAX_CHARS = 2500;
const CHUNKS_CONTEXT_MAX_CHARS = 1800;

const SYSTEM_PROMPT = `你是大模型自学平台的答疑助手。规则：
1. 只基于【参考资料】回答；资料中没有的内容，明确说"这部分课程暂时没覆盖，建议查阅官方文档"，禁止编造。
2. 禁止回答与课程无关的问题（政治、医疗、投资建议等），温和引导回学习。
3. 不越阶：学员问到高阶主题（如模型微调、底层训练细节）时，温和引导"这部分在高阶包里，先把当前小节学扎实"，不要直接展开讲解。
4. 不输出完整的大型项目代码：代码回复仅限片段级解释与纠错。
5. 语气温和、鼓励，用中文，适当使用类比帮助理解。`;

interface RetrievedChunk {
  body: string;
  sectionId: string;
  score: number;
}

/** 单机模式：内存余弦检索（嵌入以 Bytes 存储，知识块规模小，全量加载计算即可） */
async function retrieveSemantic(
  query: string,
  topK = 3
): Promise<RetrievedChunk[] | null> {
  if (!embeddingsEnabled()) return null;
  const vec = (await embedTexts([query]))?.[0];
  if (!vec) return null;
  try {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { embeddingModel: embedModelName(), embedding: { not: null } },
      select: { sectionId: true, body: true, embedding: true },
    });
    if (chunks.length === 0) return null;

    const qn = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    const scored = chunks.map((c) => {
      const bytes = c.embedding as unknown as Uint8Array;
      const v = Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
      const dot = v.reduce((s, x, i) => s + x * vec[i], 0);
      const vn = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      return { body: c.body, sectionId: c.sectionId, score: vn && qn ? dot / (vn * qn) : 0 };
    });

    return scored
      .filter((s) => 1 - s.score <= SIMILARITY_THRESHOLD_DISTANCE)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch {
    return null; // 检索失败降级关键词匹配
  }
}

/** 降级档：关键词匹配检索 */
async function retrieveKeyword(query: string, topK = 3): Promise<RetrievedChunk[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    include: { section: { select: { title: true } } },
  });
  const terms = Array.from(
    new Set(query.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9]{2,}/g) ?? [])
  );
  if (terms.length === 0) return [];

  return chunks
    .map((c) => {
      const text = `${c.body} ${c.section.title}`.toLowerCase();
      const score = terms.reduce(
        (acc, t) => acc + (text.includes(t) ? t.length : 0),
        0
      );
      return { body: c.body, sectionId: c.sectionId, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 调用 OpenAI 兼容接口（未配置 Key 时返回 null） */
async function callLlm(messages: { role: string; content: string }[]): Promise<string | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl =
    process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.LLM_MODEL || "qwen-turbo";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export interface QaAnswer {
  answer: string;
  degraded: boolean; // true = 未调用 LLM（仅检索片段）
  sources: string[]; // 命中的小节 id，前端可一键回看
}

export async function answerQuestion(
  question: string,
  sectionId?: string
): Promise<QaAnswer> {
  // 检索：语义优先，降级关键词
  const semantic = await retrieveSemantic(question);
  const chunks = semantic ?? (await retrieveKeyword(question));

  // 携带小节上下文（若提问来自某小节页面）
  let sectionCtx = "";
  if (sectionId) {
    const section = await prisma.llmSection.findUnique({
      where: { id: sectionId },
      select: { title: true, bodyMarkdown: true },
    });
    if (section) {
      sectionCtx = `\n【当前学习小节】${section.title}\n${section.bodyMarkdown.slice(0, SECTION_CONTEXT_MAX_CHARS)}`;
    }
  }

  if (chunks.length === 0 && !sectionCtx) {
    return {
      answer:
        "这个问题课程资料里暂时没有覆盖～ 建议先回到当前小节看看相关概念，或换个关键词再问我。",
      degraded: true,
      sources: [],
    };
  }

  // 上下文预算（≤4K tokens 近似）：知识块合计 1800 字 + 小节全文 2500 字
  const chunkContext = chunks
    .map((c, i) => `【参考资料${i + 1}】${c.body}`)
    .join("\n")
    .slice(0, CHUNKS_CONTEXT_MAX_CHARS);

  const userPrompt = `${chunkContext}${sectionCtx}\n\n【学员提问】${question}`;
  const llmAnswer = await callLlm([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  if (llmAnswer) {
    return {
      answer: llmAnswer,
      degraded: false,
      sources: [...new Set(chunks.map((c) => c.sectionId))],
    };
  }

  // 降级：未配置 LLM，返回检索到的最相关片段
  return {
    answer: `（开发模式：未配置 LLM，以下是最相关的课程内容）\n${chunks[0]?.body ?? "暂无相关内容"}`,
    degraded: true,
    sources: [...new Set(chunks.map((c) => c.sectionId))],
  };
}
