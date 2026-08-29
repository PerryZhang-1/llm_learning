"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, Page, PageHeader, CardBox } from "@/components/ui";

interface FeedbackItem {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  user: { nickname: string; email: string };
  section: { title: string };
}

/**
 * 极简管理端（§7.1 管理接口）：反馈处理闭环
 * 权限：邮箱含 admin（开发约定；生产换角色系统）
 */
export default function AdminPage() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");

  async function load(status = filter) {
    setError(null);
    const { status: code, data } = await apiFetch(`/api/admin/feedback?status=${status}`);
    if (code === 403) {
      setError("无权限：请使用管理员邮箱（含 admin）登录");
      setItems(null);
      return;
    }
    if (data.ok) setItems(data.items);
  }

  async function transition(id: string, status: string) {
    const { data } = await apiFetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!data.ok) {
      toast(data.message);
      return;
    }
    toast(
      status === "accepted"
        ? data.awarded
          ? "已确认，已给学员加 5 分"
          : "已确认（该学员今日已达反馈积分上限）"
        : "状态已更新"
    );
    load();
  }

  const statusMeta: Record<string, { label: string; color: string }> = {
    open: { label: "待处理", color: "bg-amber-100 text-amber-700" },
    accepted: { label: "已确认", color: "bg-accent text-accent-foreground" },
    fixed: { label: "已修复", color: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "已驳回", color: "bg-muted text-muted-foreground" },
  };

  return (
    <Page>
      <PageHeader title="极简管理端 · 内容反馈" />
      <div className="mt-4 flex gap-2">
        {["open", "accepted", "fixed", ""].map((f) => (
          <Button
            key={f || "all"}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => {
              setFilter(f);
              load(f);
            }}
          >
            {f ? statusMeta[f].label : "全部"}
          </Button>
        ))}
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => load()}>
          刷新
        </Button>
      </div>

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {items === null && !error && (
        <p className="mt-6 text-sm text-muted-foreground">点击上方「刷新」加载反馈列表</p>
      )}
      {items !== null && items.length === 0 && (
        <div className="mt-6 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          暂无反馈，干净清爽～
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items?.map((it) => (
          <CardBox key={it.id} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`rounded-full px-2 py-0.5 ${statusMeta[it.status]?.color}`}>
                {statusMeta[it.status]?.label ?? it.status}
              </span>
              <span>
                {it.user.nickname}（{it.user.email}）
              </span>
              <span>· {it.section.title}</span>
              <span className="ml-auto">{new Date(it.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-foreground">{it.content}</p>
            {it.status === "open" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => transition(it.id, "accepted")}>
                  确认有效（+5 分答谢）
                </Button>
                <Button size="sm" variant="ghost" onClick={() => transition(it.id, "rejected")}>
                  驳回
                </Button>
              </div>
            )}
            {it.status === "accepted" && (
              <Button
                size="sm"
                className="mt-3 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => transition(it.id, "fixed")}
              >
                标记已修复
              </Button>
            )}
          </CardBox>
        ))}
      </div>
    </Page>
  );
}
