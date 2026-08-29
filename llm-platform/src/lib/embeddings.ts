/**
 * DashScope 嵌入（R3 生产档）
 * - OpenAI 兼容端点 /embeddings，模型 EMBED_MODEL（qwen3.7-text-embedding，1024 维）
 * - 未配置 DASHSCOPE_API_KEY 或调用失败 → 返回 null（上层降级为关键词检索）
 * - 批量接口按 10 条一组切分（DashScope embeddings 单次输入上限保护）
 */

const EMBED_BATCH = 10;

export function embedModelName(): string {
  return process.env.EMBEDDING_MODEL || process.env.EMBED_MODEL || "qwen3.7-text-embedding";
}

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key || texts.length === 0) return null;
  const baseUrl =
    process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: embedModelName(),
          input: batch,
          dimensions: 1024,
          encoding_format: "float",
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: { embedding: number[] }[] };
      const rows = data?.data;
      if (!Array.isArray(rows) || rows.length !== batch.length) return null;
      // 按 index 归位，保证与输入顺序一致
      const ordered = [...rows]
        .sort((a, b) => (a as unknown as { index: number }).index - (b as unknown as { index: number }).index);
      for (const r of ordered) out.push(r.embedding);
    } catch {
      return null;
    }
  }
  return out;
}

/** pgvector 字面量：'[0.01,0.02,...]' */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
