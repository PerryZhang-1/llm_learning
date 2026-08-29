"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, Page, useAuthGuard, useToast } from "@/components/ui";

interface Section {
  id: string;
  title: string;
  sectionType: string;
  estimatedMinutes: number;
  completed: boolean;
}
interface Chapter {
  id: string;
  name: string;
  sections: Section[];
}
interface Module {
  id: string;
  code: string;
  name: string;
  description: string;
  isOptional: boolean;
  chapters: Chapter[];
}
interface TreeData {
  ok: boolean;
  packs: { prepPackOn: boolean; advPackOn: boolean };
  modules: Module[];
}

/**
 * 知识树页（§8.1）：模块 → 章节 → 小节，自由跳转不拦截
 */
export default function TreePage() {
  const { data, loading } = useAuthGuard<TreeData>(() => apiFetch("/api/tree"));
  const { show, node } = useToast();
  const [packs, setPacks] = useState<TreeData["packs"] | null>(null);

  if (loading || !data) {
    return <Page><div className="text-slate-400">加载中…</div></Page>;
  }

  const packState = packs ?? data.packs;

  async function togglePack(key: "prepPackOn" | "advPackOn") {
    const next = { ...packState, [key]: !packState[key] };
    const { data: res } = await apiFetch("/api/me/packs", {
      method: "PATCH",
      body: JSON.stringify({ [key]: next[key] }),
    });
    if (res.ok) {
      setPacks(next);
      show(next[key] ? "已打开，随时可以关掉，不影响进度" : "已收起，想看随时打开");
    }
  }

  return (
    <Page>
      {node}
      <h1 className="text-2xl font-bold text-slate-800">知识树</h1>
      <p className="mt-1 text-sm text-slate-400">随便点，按你的节奏来；可选包不影响主线进度</p>

      <div className="mt-6 space-y-6">
        {data.modules.map((m) => {
          const hidden =
            m.isOptional &&
            ((m.code === "prep" && !packState.prepPackOn) ||
              (m.code === "engineering" && !packState.advPackOn));
          const doneCount = m.chapters.flatMap((c) => c.sections).filter((s) => s.completed).length;
          const totalCount = m.chapters.reduce((acc, c) => acc + c.sections.length, 0);

          return (
            <div key={m.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">
                    {m.name}
                    {m.isOptional && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        可选包
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-400">{m.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {totalCount > 0 && (
                    <span className="text-xs text-slate-400">
                      {doneCount}/{totalCount}
                    </span>
                  )}
                  {m.isOptional && (
                    <button
                      onClick={() =>
                        togglePack(m.code === "prep" ? "prepPackOn" : "advPackOn")
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hidden
                          ? "bg-slate-100 text-slate-400"
                          : "bg-indigo-50 text-indigo-600"
                      }`}
                    >
                      {hidden ? "打开" : "收起"}
                    </button>
                  )}
                </div>
              </div>

              {!hidden && (
                <div className="mt-4 space-y-4">
                  {m.chapters.map((c) => (
                    <div key={c.id}>
                      <h3 className="text-sm font-medium text-slate-500">{c.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.sections.map((s) => (
                          <Link
                            key={s.id}
                            href={`/learn/${s.id}`}
                            className={`rounded-lg border px-3 py-2 text-sm transition hover:border-indigo-400 ${
                              s.completed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 text-slate-600"
                            }`}
                          >
                            {s.completed ? "✓ " : ""}
                            {s.title}
                            <span className="ml-1 text-xs text-slate-300">
                              {s.estimatedMinutes}min
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
