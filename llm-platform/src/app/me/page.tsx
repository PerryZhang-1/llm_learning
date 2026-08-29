"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, Page, useAuthGuard, useToast } from "@/components/ui";

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
  const { node } = useToast();

  async function loadWrongbook() {
    if (wrongItems) return;
    const { data } = await apiFetch("/api/me/wrongbook");
    if (data.ok) setWrongItems(data.items);
  }

  if (!growth) {
    return <Page><div className="text-slate-400">加载中…</div></Page>;
  }

  const earnedCount = growth.badges.filter((b) => b.earned).length;

  return (
    <Page>
      {node}
      <h1 className="text-2xl font-bold text-slate-800">个人中心</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="总积分" value={growth.points} />
        <Card label="连续学习" value={`${growth.streakCurrent} 天`} />
        <Card label="历史最高连续" value={`${growth.streakBest} 天`} />
        <Card label="完成小节" value={`${growth.completedSections}/${growth.totalSections}`} />
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href="/assessment"
          className="rounded-lg border border-indigo-200 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
        >
          重新测评
        </Link>
        <Link
          href="/tree"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:border-indigo-300"
        >
          去看知识树
        </Link>
      </div>

      <div className="mt-8 flex gap-4 border-b border-slate-200">
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
              className={`rounded-xl p-4 text-center shadow-sm ${
                b.earned ? "bg-white" : "bg-slate-100 opacity-60"
              }`}
            >
              <div className="text-3xl">{b.earned ? "🏅" : "🔒"}</div>
              <div className="mt-2 text-sm font-bold text-slate-700">{b.name}</div>
              <div className="mt-1 text-xs text-slate-400">{b.desc}</div>
            </div>
          ))}
        </div>
      ) : wrongItems === null ? (
        <div className="mt-6 text-slate-400">加载中…</div>
      ) : wrongItems.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center text-slate-400 shadow-sm">
          还没有错题，保持这个状态～
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {wrongItems.map((w) => (
            <div key={w.exerciseId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  w.conquered ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {w.conquered ? "已征服" : "待攻克"}
                </span>
                <span className="text-xs text-slate-400">
                  {w.sectionTitle} · 已尝试 {w.attempts} 次
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{w.question}</p>
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                💡 {w.explanation}
              </div>
              <Link
                href={`/learn/${w.sectionId}`}
                className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
              >
                回到对应小节 →
              </Link>
            </div>
          ))}
          <p className="text-xs text-slate-400">
            在小节页面重新做对这些题，就会点亮「已征服」～ 已征服 {growth.conqueredTotal} 题
          </p>
        </div>
      )}
    </Page>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
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
        active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}
