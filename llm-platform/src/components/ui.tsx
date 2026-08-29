"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, type ReactNode } from "react";

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

/** 顶部导航 */
export function TopNav() {
  const links = [
    { href: "/", label: "学习总览" },
    { href: "/tree", label: "知识树" },
    { href: "/me", label: "个人中心" },
    { href: "/admin", label: "管理端" },
  ];
  return (
    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-600">
          大模型自学平台
        </Link>
        <div className="flex gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-600 hover:text-indigo-600">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** 温和提示 Toast（无惩罚文案基线：永远不出现负面措辞） */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const node = toast ? (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-indigo-600 px-5 py-2 text-sm text-white shadow-lg">
      {toast}
    </div>
  ) : null;
  return { show, node };
}

/** 页面容器 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
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
