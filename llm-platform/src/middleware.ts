import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 边缘中间件：IP 级滑动窗口限流兜底（开发文档 §7.1 接口安全基线）
 * 单一权威数据源仍是 DB（答疑余量/积分幂等），此处仅防匿名接口滥用：
 * - /api/auth/send-code：单 IP 60 秒内最多 5 次
 * - 其余 API：单 IP 60 秒内最多 120 次
 * 内存计数，实例重启自动清零（开发环境足够；生产由平台边缘限流替代）
 */

interface Window {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Window>();
const WINDOW_MS = 60_000;

function hit(key: string): number {
  const now = Date.now();
  const w = counters.get(key);
  if (!w || now > w.resetAt) {
    counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // 防止无界增长
    if (counters.size > 10000) counters.clear();
    return 1;
  }
  w.count += 1;
  return w.count;
}

export function middleware(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const isSendCode = req.nextUrl.pathname === "/api/auth/send-code";
  const limit = isSendCode ? 5 : 120;
  const key = `${ip}:${isSendCode ? "send-code" : "api"}`;

  if (hit(key) > limit) {
    return NextResponse.json(
      { ok: false, message: "操作有点频繁，稍等一下再试～" },
      { status: 429 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
