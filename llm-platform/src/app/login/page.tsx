"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, useToast } from "@/components/ui";

/**
 * 登录页：邮箱 + 验证码（开发模式固定 123456）
 */
export default function LoginPage() {
  const router = useRouter();
  const { show, node } = useToast();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const { data } = await apiFetch("/api/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (!data.ok) {
      show(data.message);
      return;
    }
    setSent(true);
    show(data.message);
  }

  async function login() {
    setBusy(true);
    try {
      const { data } = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, code, nickname }),
      });
      if (!data.ok) {
        show(data.message);
        return;
      }
      // 新用户先测评；老用户回总览
      router.replace(data.isNewUser ? "/assessment" : "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      {node}
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">登录 / 注册</h1>
        <p className="mt-1 text-sm text-slate-400">邮箱验证码登录，无需记密码</p>

        <label className="mt-6 block text-sm text-slate-600">邮箱</label>
        <div className="mt-1 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            onClick={sendCode}
            className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-100"
          >
            {sent ? "重发" : "发验证码"}
          </button>
        </div>

        <label className="mt-4 block text-sm text-slate-600">验证码</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          placeholder="开发模式固定 123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <label className="mt-4 block text-sm text-slate-600">
          昵称 <span className="text-slate-300">（选填）</span>
        </label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          placeholder="给自己起个名字"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />

        <button
          onClick={login}
          disabled={busy || !email || !code}
          className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "登录中…" : "进入学习"}
        </button>
      </div>
    </div>
  );
}
