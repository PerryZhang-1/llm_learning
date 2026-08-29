import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 激励引擎专项测试配置（R5 前置）。
 * 测试直连 .env 里的真实数据库（Neon），使用独立测试用户并在套件结束后清理——
 * 幂等性依赖数据库唯一约束，mock 无法验证真约束。
 * CI 环境无 .env 文件，DATABASE_URL 由 workflow 的 secrets 提供（NEON_TEST_DATABASE_URL）。
 */
const env: Record<string, string> = {};
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}

export default defineConfig({
  test: {
    env,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    retries: 2, // 本机到 Neon 跨洋链路偶发抖动；CI（GitHub 美区）不需要重试也稳定
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // 单 worker：全程复用一个 Prisma 连接池
  },
});
