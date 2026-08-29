/**
 * R3 阈值校准（§10.4）：用 tests/qa-threshold/golden-set.json（100 条标注）评估检索阈值。
 *
 * 方法：对每条问题做嵌入 → 取语料最小余弦距离 → 扫描阈值候选，
 * 报告每个阈值下的：应答召回率（应答条目被命中）、应拒答误放行率（应拒答条目被命中）。
 * 选型标准（§10.4）：召回率尽量高、误放行率尽量低；兼顾精确率与召回率。
 *
 * 用法：npx tsx scripts/qa-calibrate.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { embedModelName, embedTexts, embeddingsEnabled } from "../src/lib/embeddings";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const GOLDEN = JSON.parse(
  readFileSync(join(ROOT, "..", "tests", "qa-threshold", "golden-set.json"), "utf8")
) as { items: { expect: "answer" | "reject"; src?: string; q: string }[] };

const THRESHOLDS = [0.3, 0.35, 0.4, 0.45, 0.5];

const prisma = new PrismaClient();

async function minDistance(vec: number[]): Promise<number> {
  const literal = `[${vec.join(",")}]`;
  // 本机到 Neon 的链路偶发抖动：3 次重试兜底
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await prisma.$queryRaw<{ distance: number }[]>`
        SELECT MIN(embedding <=> ${literal}::vector) AS distance FROM "KnowledgeChunk"
        WHERE "embeddingModel" = ${embedModelName()} AND embedding IS NOT NULL
      `;
      return Number(rows[0]?.distance ?? 1);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  if (!embeddingsEnabled()) {
    console.error("未配置 DASHSCOPE_API_KEY，无法校准");
    process.exit(1);
  }
  console.log(`标注集 ${GOLDEN.items.length} 条（应答 ${GOLDEN.items.filter((i) => i.expect === "answer").length} / 应拒答 ${GOLDEN.items.filter((i) => i.expect === "reject").length}）；嵌入模型 ${embedModelName()}\n`);

  // 分批嵌入全部问题
  const questions = GOLDEN.items.map((i) => i.q);
  const vectors = await embedTexts(questions);
  if (!vectors) {
    console.error("嵌入调用未成功（网络或配额问题），稍后重试");
    process.exit(1);
  }

  // 每条问题取语料最小余弦距离
  const distances: { expect: string; src?: string; dist: number }[] = [];
  for (let i = 0; i < questions.length; i++) {
    const d = await minDistance(vectors[i]);
    distances.push({ expect: GOLDEN.items[i].expect, src: GOLDEN.items[i].src, dist: d });
    process.stdout.write(`\r嵌入检索进度 ${i + 1}/${questions.length}`);
  }
  console.log("\n");

  console.log("阈值   | 应答召回率 | 应拒答误放行率 | 备注");
  console.log("-------+-----------+---------------+-----");
  for (const t of THRESHOLDS) {
    const answers = distances.filter((d) => d.expect === "answer");
    const rejects = distances.filter((d) => d.expect === "reject");
    const recall = answers.filter((d) => d.dist <= t).length / answers.length;
    const falsePass = rejects.filter((d) => d.dist <= t).length / rejects.length;
    const note = t === 0.35 ? "← 当前线上阈值" : "";
    console.log(
      `${t.toFixed(2).padEnd(6)} | ${(recall * 100).toFixed(0).padStart(5)}%     | ${(falsePass * 100).toFixed(0).padStart(7)}%      | ${note}`
    );
  }

  // 各阈值 F1（以召回为主目标、误放行为代价）
  let best = { t: 0.35, f1: -1 };
  for (const t of THRESHOLDS) {
    const answers = distances.filter((d) => d.expect === "answer");
    const rejects = distances.filter((d) => d.expect === "reject");
    const recall = answers.filter((d) => d.dist <= t).length / answers.length;
    const falsePass = rejects.filter((d) => d.dist <= t).length / rejects.length;
    const precision = recall + falsePass === 0 ? 0 : recall / (recall + falsePass);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    if (f1 > best.f1) best = { t, f1 };
  }
  console.log(`\n建议阈值（F1 最优）：${best.t}（F1=${best.f1.toFixed(3)}）；当前线上 0.35，若偏差明显请同步 src/lib/qa.ts 的 SIMILARITY_THRESHOLD_DISTANCE = ${(1 - best.t).toFixed(2)}`);

  // 暴露问题清单（距离离阈值最远的应答条目 = 最容易被误拒的合法问题）
  const borderline = distances
    .filter((d) => d.expect === "answer")
    .sort((a, b) => b.dist - a.dist)
    .slice(0, 5);
  console.log("\n最接近阈值的应答条目（误拒高风险，供人工复核）：");
  for (const b of borderline) console.log(`  · 距离 ${b.dist.toFixed(3)} [${b.src}] ${GOLDEN.items.find((i) => i.src === b.src && b.dist >= 0)?.q ?? ""}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
