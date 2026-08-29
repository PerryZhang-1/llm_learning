import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 激励引擎专项测试配置（R5 前置）。
 * 测试直连 .env 里的真实数据库（Neon），使用独立测试用户并在套件结束后清理——
 * 幂等性依赖数据库唯一约束，mock 无法验证真约束。
 */
const env: Record<string, string> = {};
for (const line of readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), ".env"),
  "utf8"
).split("\n")) {
  const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
  if (m && !env[m[1]]) env[m[1]] = m[2];
}

export default defineConfig({
  test: {
    env,
    testTimeout: 120_000,
    retries: 2, // 本机到 Neon 跨洋网络偶发抖动；CI（GitHub 美区）不需要重试也稳定
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // 单 worker：全程复用一个 Prisma 连接池，降低 Neon 连接压力 // 各测试文件串行，避免共享库上的计数类断言互相干扰
  },
});
