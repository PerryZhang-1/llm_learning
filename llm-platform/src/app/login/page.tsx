"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/components/ui";

/**
 * 登录页：邮箱 + 验证码（开发模式固定 123456）
 */
export default function LoginPage() {
  const router = useRouter();
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
    setSent(true);
    toast(data.message);
  }

  async function login() {
    setBusy(true);
    try {
      const { data } = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, code, nickname }),
      });
      if (!data.ok) {
        toast(data.message);
        return;
      }
      // 新用户先测评；老用户回总览
      router.replace(data.isNewUser ? "/assessment" : "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">登录 / 注册</h1>
        <p className="mt-1 text-sm text-muted-foreground">邮箱验证码登录，无需记密码</p>

        <label className="mt-6 block text-sm text-muted-foreground">邮箱</label>
        <div className="mt-1.5 flex gap-2">
          <Input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={sendCode}
          >
            {sent ? "重发" : "发验证码"}
          </Button>
        </div>

        <label className="mt-4 block text-sm text-muted-foreground">验证码</label>
        <Input
          className="mt-1.5"
          placeholder="开发模式固定 123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <label className="mt-4 block text-sm text-muted-foreground">
          昵称 <span className="text-muted-foreground/50">（选填）</span>
        </label>
        <Input
          className="mt-1.5"
          placeholder="给自己起个名字"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />

        <Button
          onClick={login}
          disabled={busy || !email || !code}
          className="mt-6 w-full py-2.5"
        >
          {busy ? "登录中…" : "进入学习"}
        </Button>
      </div>
    </div>
  );
}
