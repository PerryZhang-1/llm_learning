"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch, TopNav, CardBox } from "@/components/ui";

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (state === "guest") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-accent/60 to-background px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          大模型，从零开始学透
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          结构化课程 · 轻松的游戏化激励 · AI 答疑助手。按你自己的节奏来，每一步都算数。
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/login">
            <Button className="px-8 py-3">开始学习</Button>
          </Link>
        </div>
      </div>
    );
  }

  const o = overview!;
  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          欢迎回来，{o.nickname} 👋
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="积分" value={o.points} />
          <StatCard label="连续学习" value={`${o.streakCurrent} 天`} />
          <StatCard label="历史最高" value={`${o.streakBest} 天`} />
          <StatCard label="完成小节" value={`${o.completedCount}/${o.totalCount}`} />
        </div>

        <CardBox className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">整体进度</span>
            <span className="text-sm font-medium text-primary">{o.percent}%</span>
          </div>
          <Progress value={o.percent} className="mt-3 h-3" />
        </CardBox>

        {o.assessmentSummary && (
          <p className="mt-6 rounded-xl border border-primary/15 bg-accent px-4 py-3 text-sm text-accent-foreground">
            {o.assessmentSummary}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {o.nextSectionId ? (
            <Link href={`/learn/${o.nextSectionId}`}>
              <Button className="px-6 py-3">继续学习 →</Button>
            </Link>
          ) : (
            <span className="rounded-lg bg-emerald-100 px-6 py-3 font-medium text-emerald-700">
              全部课程都学完啦，太棒了！
            </span>
          )}
          {!o.hasAssessment && (
            <Link href="/assessment">
              <Button variant="outline" className="px-6 py-3">
                做一次入学测评
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <CardBox className="p-4">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </CardBox>
  );
}
