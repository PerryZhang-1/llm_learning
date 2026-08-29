"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch, Page, PageHeader, CardBox, useAuthGuard } from "@/components/ui";

interface Badge {
  code: string;
  name: string;
  category: string;
  desc: string;
  earned: boolean;
}
interface Growth {
  ok: boolean;
  points: number;
  streakCurrent: number;
  streakBest: number;
  completedSections: number;
  totalSections: number;
  wrongTotal: number;
  conqueredTotal: number;
  badges: Badge[];
}
interface WrongItem {
  exerciseId: string;
  attempts: number;
  conquered: boolean;
  sectionId: string;
  sectionTitle: string;
  question: string;
  knowledgePoint: string;
  explanation: string;
}

/**
 * 个人中心（§8.1）：勋章墙、统计、错题本、重新测评入口、反馈记录
 */
export default function MePage() {
  const { data: growth } = useAuthGuard<Growth>(() => apiFetch("/api/me/growth"));
  const [wrongItems, setWrongItems] = useState<WrongItem[] | null>(null);
  const [tab, setTab] = useState<"badges" | "wrongbook">("badges");

  async function loadWrongbook() {
    if (wrongItems) return;
    const { data } = await apiFetch("/api/me/wrongbook");
    if (data.ok) setWrongItems(data.items);
  }

  if (!growth) {
    return (
      <Page>
        <div className="text-muted-foreground">加载中…</div>
      </Page>
    );
  }

  const earnedCount = growth.badges.filter((b) => b.earned).length;

  return (
    <Page>
      <PageHeader title="个人中心" />

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="总积分" value={growth.points} />
        <StatCard label="连续学习" value={`${growth.streakCurrent} 天`} />
        <StatCard label="历史最高连续" value={`${growth.streakBest} 天`} />
        <StatCard
          label="完成小节"
          value={`${growth.completedSections}/${growth.totalSections}`}
        />
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={() => (window.location.href = "/assessment")}>
          重新测评
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/tree")}>
          去看知识树
        </Button>
      </div>

      <div className="mt-8 flex gap-4 border-b border-border">
        <TabButton active={tab === "badges"} onClick={() => setTab("badges")}>
          勋章墙（{earnedCount}/{growth.badges.length}）
        </TabButton>
        <TabButton
          active={tab === "wrongbook"}
          onClick={() => {
            setTab("wrongbook");
            loadWrongbook();
          }}
        >
          错题本（{growth.wrongTotal}）
        </TabButton>
      </div>

      {tab === "badges" ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {growth.badges.map((b) => (
            <div
              key={b.code}
              className={`rounded-xl border p-4 text-center ${
                b.earned ? "border-primary/20 bg-card shadow-sm" : "border-border bg-muted opacity-60"
              }`}
            >
              <div className="text-3xl">{b.earned ? "🏅" : "🔒"}</div>
              <div className="mt-2 text-sm font-bold text-foreground">{b.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{b.desc}</div>
            </div>
          ))}
        </div>
      ) : wrongItems === null ? (
        <div className="mt-6 text-muted-foreground">加载中…</div>
      ) : wrongItems.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-sm">
          还没有错题，保持这个状态～
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {wrongItems.map((w) => (
            <CardBox key={w.exerciseId} className="p-4">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    w.conquered
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {w.conquered ? "已征服" : "待攻克"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {w.sectionTitle} · 已尝试 {w.attempts} 次
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground">{w.question}</p>
              <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
                💡 {w.explanation}
              </div>
              <Link
                href={`/learn/${w.sectionId}`}
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                回到对应小节 →
              </Link>
            </CardBox>
          ))}
          <p className="text-xs text-muted-foreground">
            在小节页面重新做对这些题，就会点亮「已征服」～ 已征服 {growth.conqueredTotal} 题
          </p>
        </div>
      )}
    </Page>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 pb-2 text-sm font-medium ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
