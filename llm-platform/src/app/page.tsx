"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/components/ui";

interface Overview {
  ok: boolean;
  nickname: string;
  points: number;
  streakCurrent: number;
  streakBest: number;
  completedCount: number;
  totalCount: number;
  percent: number;
  nextSectionId: string | null;
  hasAssessment: boolean;
  assessmentSummary: string | null;
}

/**
 * 首页（§8.1）：
 * - 未登录 → 温和落地页 + 登录入口
 * - 已登录 → 学习总览（老用户直达）
 */
export default function HomePage() {
  const [state, setState] = useState<"loading" | "guest" | "user">("loading");
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    apiFetch("/api/me/overview")
      .then(({ status, data }) => {
        if (status === 401) {
          setState("guest");
        } else {
          setOverview(data as Overview);
          setState("user");
        }
      })
      .catch(() => setState("guest"));
  }, []);

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">加载中…</div>;
  }

  if (state === "guest") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-6 text-center">
        <h1 className="text-4xl font-bold text-slate-800">大模型，从零开始学透</h1>
        <p className="mt-4 max-w-xl text-slate-500">
          结构化课程 · 无惩罚游戏化激励 · AI 答疑助手。按你自己的节奏来，我们只加分，从不扣分。
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
          >
            开始学习
          </Link>
        </div>
      </div>
    );
  }

  const o = overview!;
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold text-indigo-600">大模型自学平台</span>
          <Link href="/tree" className="text-sm text-slate-600 hover:text-indigo-600">知识树</Link>
          <Link href="/me" className="text-sm text-slate-600 hover:text-indigo-600">个人中心</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800">
          欢迎回来，{o.nickname} 👋
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="积分" value={o.points} />
          <StatCard label="连续学习" value={`${o.streakCurrent} 天`} />
          <StatCard label="历史最高" value={`${o.streakBest} 天`} />
          <StatCard label="完成小节" value={`${o.completedCount}/${o.totalCount}`} />
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">整体进度</span>
            <span className="text-sm font-medium text-indigo-600">{o.percent}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${o.percent}%` }}
            />
          </div>
        </div>

        {o.assessmentSummary && (
          <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {o.assessmentSummary}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {o.nextSectionId ? (
            <Link
              href={`/learn/${o.nextSectionId}`}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
            >
              继续学习 →
            </Link>
          ) : (
            <span className="rounded-lg bg-emerald-100 px-6 py-3 font-medium text-emerald-700">
              全部课程都学完啦，太棒了！
            </span>
          )}
          {!o.hasAssessment && (
            <Link
              href="/assessment"
              className="rounded-lg border border-indigo-200 px-6 py-3 font-medium text-indigo-600 hover:bg-indigo-50"
            >
              做一次入学测评
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
