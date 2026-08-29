"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, Page, PageHeader, CardBox, useAuthGuard } from "@/components/ui";

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
  const [packs, setPacks] = useState<TreeData["packs"] | null>(null);

  if (loading || !data) {
    return (
      <Page>
        <div className="text-muted-foreground">加载中…</div>
      </Page>
    );
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
      toast(next[key] ? "已打开，随时可以关掉，不影响进度" : "已收起，想看随时打开");
    }
  }

  return (
    <Page>
      <PageHeader title="知识树" desc="随便点，按你的节奏来；可选包不影响主线进度" />

      <div className="mt-6 space-y-6">
        {data.modules.map((m) => {
          const hidden =
            m.isOptional &&
            ((m.code === "prep" && !packState.prepPackOn) ||
              (m.code === "engineering" && !packState.advPackOn));
          const doneCount = m.chapters
            .flatMap((c) => c.sections)
            .filter((s) => s.completed).length;
          const totalCount = m.chapters.reduce((acc, c) => acc + c.sections.length, 0);

          return (
            <CardBox key={m.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-foreground">
                    {m.name}
                    {m.isOptional && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        可选包
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {totalCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {doneCount}/{totalCount}
                    </span>
                  )}
                  {m.isOptional && (
                    <Button
                      size="sm"
                      variant={hidden ? "secondary" : "outline"}
                      onClick={() =>
                        togglePack(m.code === "prep" ? "prepPackOn" : "advPackOn")
                      }
                    >
                      {hidden ? "打开" : "收起"}
                    </Button>
                  )}
                </div>
              </div>

              {!hidden && (
                <div className="mt-4 space-y-4">
                  {m.chapters.map((c) => (
                    <div key={c.id}>
                      <h3 className="text-sm font-medium text-muted-foreground">{c.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.sections.map((s) => (
                          <Link
                            key={s.id}
                            href={`/learn/${s.id}`}
                            className={`rounded-lg border px-3 py-2 text-sm transition hover:border-ring/60 ${
                              s.completed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {s.completed ? "✓ " : ""}
                            {s.title}
                            <span className="ml-1 text-xs text-muted-foreground/60">
                              {s.estimatedMinutes}min
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBox>
          );
        })}
      </div>
    </Page>
  );
}
