import { prisma } from "./db";

/**
 * AI 答疑（开发文档 §10）
 * 开发环境：无嵌入模型 → 关键词匹配检索降级；无 LLM_API_KEY → 返回检索片段 + 温和降级提示
 * 生产环境：bge-m3 嵌入 + pgvector 余弦检索 + LLM 生成（注入总量 ≤4K tokens）
 */

const SYSTEM_PROMPT = `你是大模型自学平台的答疑助手。规则：
1. 只基于【参考资料】回答；资料中没有的内容，明确说"这部分课程暂时没覆盖，建议查阅官方文档"，禁止编造。
2. 禁止回答与课程无关的问题（政治、医疗、投资建议等），温和引导回学习。
3. 语气温和、鼓励，用中文，适当使用类比帮助理解。`;

interface RetrievedChunk {
  body: string;
  sectionId: string;
  score: number;
}

/** 简易关键词检索（开发环境降级方案；生产替换为向量检索） */
async function retrieve(query: string, topK = 3): Promise<RetrievedChunk[]> {
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
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl =
    process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.LLM_MODEL || "qwen-turbo";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
  const chunks = await retrieve(question);

  // 携带小节上下文（若提问来自某小节页面）
  let sectionCtx = "";
  if (sectionId) {
    const section = await prisma.llmSection.findUnique({
      where: { id: sectionId },
      select: { title: true, bodyMarkdown: true },
    });
    if (section) {
      sectionCtx = `\n【当前学习小节】${section.title}\n${section.bodyMarkdown.slice(0, 1500)}`;
    }
  }

  const context = chunks
    .map((c, i) => `【参考资料${i + 1}】${c.body}`)
    .join("\n");

  if (chunks.length === 0 && !sectionCtx) {
    return {
      answer:
        "这个问题课程资料里暂时没有覆盖～ 建议先回到当前小节看看相关概念，或换个关键词再问我。",
      degraded: true,
      sources: [],
    };
  }

  const userPrompt = `${context}${sectionCtx}\n\n【学员提问】${question}`;
  const llmAnswer = await callLlm([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  if (llmAnswer) {
    return { answer: llmAnswer, degraded: false, sources: chunks.map((c) => c.sectionId) };
  }

  // 降级：未配置 LLM，返回检索到的最相关片段
  return {
    answer: `（开发模式：未配置 LLM，以下是最相关的课程内容）\n${chunks[0]?.body ?? "暂无相关内容"}`,
    degraded: true,
    sources: chunks.map((c) => c.sectionId),
  };
}
