"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** 统一 fetch：JSON 提交，401 时跳登录 */
export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.href = "/login";
    throw new Error("未登录");
  }
  return { status: res.status, data };
}

const NAV_LINKS = [
  { href: "/", label: "学习总览" },
  { href: "/tree", label: "知识树" },
  { href: "/me", label: "个人中心" },
  { href: "/admin", label: "管理端" },
];

/** 顶部导航（DESIGN.md：sticky + backdrop-blur + token 配色） */
export function TopNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-border/60 bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-primary">
          大模型自学平台
        </Link>
        <div className="flex gap-1 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** 页面容器 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

/** 页面大标题 + 副标题的统一规格 */
export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
    </div>
  );
}

/** 统一卡片容器 */
export function CardBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-5 shadow-sm ${className}`}>{children}</div>;
}

/** 未登录守卫：数据返回 401 时已由 apiFetch 跳转，此处仅渲染占位 */
export function useAuthGuard<T>(fetcher: () => Promise<{ status: number; data: T }>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then(({ status, data }) => {
        if (cancelled) return;
        if (status === 401) {
          router.replace("/login");
          return;
        }
        setData(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading };
}

// re-export 便于页面统一引入
export { Button };
