"use client";

import { useState } from "react";
import { apiFetch, Page, useToast } from "@/components/ui";

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
  const { show, node } = useToast();

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
      show(data.message);
      return;
    }
    show(status === "accepted" ? (data.awarded ? "已确认，已给学员加 5 分" : "已确认（该学员今日已达反馈积分上限）") : "状态已更新");
    load();
  }

  const statusMeta: Record<string, { label: string; color: string }> = {
    open: { label: "待处理", color: "bg-amber-100 text-amber-700" },
    accepted: { label: "已确认", color: "bg-indigo-100 text-indigo-700" },
    fixed: { label: "已修复", color: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "已驳回", color: "bg-slate-100 text-slate-500" },
  };

  return (
    <Page>
      {node}
      <h1 className="text-2xl font-bold text-slate-800">极简管理端 · 内容反馈</h1>
      <div className="mt-4 flex gap-2">
        {["open", "accepted", "fixed", ""].map((f) => (
          <button
            key={f || "all"}
            onClick={() => {
              setFilter(f);
              load(f);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-500 shadow-sm"
            }`}
          >
            {f ? statusMeta[f].label : "全部"}
          </button>
        ))}
        <button
          onClick={() => load()}
          className="ml-auto rounded-lg bg-indigo-50 px-4 py-1.5 text-sm text-indigo-600"
        >
          刷新
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-rose-500">{error}</p>}
      {items === null && !error && (
        <p className="mt-6 text-sm text-slate-400">点击上方「刷新」加载反馈列表</p>
      )}
      {items !== null && items.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          暂无反馈，干净清爽～
        </p>
      )}

      <div className="mt-4 space-y-3">
        {items?.map((it) => (
          <div key={it.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`rounded-full px-2 py-0.5 ${statusMeta[it.status]?.color}`}>
                {statusMeta[it.status]?.label ?? it.status}
              </span>
              <span>{it.user.nickname}（{it.user.email}）</span>
              <span>· {it.section.title}</span>
              <span className="ml-auto">{new Date(it.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{it.content}</p>
            {it.status === "open" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => transition(it.id, "accepted")}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
                >
                  确认有效（+5 分答谢）
                </button>
                <button
                  onClick={() => transition(it.id, "rejected")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500"
                >
                  驳回
                </button>
              </div>
            )}
            {it.status === "accepted" && (
              <button
                onClick={() => transition(it.id, "fixed")}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
              >
                标记已修复
              </button>
            )}
          </div>
        ))}
      </div>
    </Page>
  );
}
