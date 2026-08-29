"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/components/ui";

/**
 * 入学测评页（§8.1）：四个温和的问题 → 生成个性化学习路径
 */
export default function AssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    pythonLevel: "basic",
    hasMlBackground: false,
    goal: "apply",
    weeklyHours: 5,
  });
  const [result, setResult] = useState<{ summary: string } | null>(null);

  async function submit() {
    const { status, data } = await apiFetch("/api/assessment", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (status !== 200 || !data.ok) {
      toast(data.message ?? "提交没有成功，再试一次就好");
      return;
    }
    setResult(data.result);
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-3 text-xl font-bold text-foreground">你的专属路径已生成</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          <Button onClick={() => router.push("/tree")} className="mt-6 px-8 py-3">
            去看知识树
          </Button>
        </div>
      </div>
    );
  }

  const steps = [
    {
      title: "你的 Python 水平大概是？",
      options: [
        { value: "none", label: "没怎么接触过" },
        { value: "basic", label: "写过一些基础代码" },
        { value: "proficient", label: "比较熟练" },
      ],
      key: "pythonLevel" as const,
    },
    {
      title: "接触过机器学习/深度学习吗？",
      options: [
        { value: "false", label: "还没有" },
        { value: "true", label: "学过一些" },
      ],
      key: "hasMlBackground" as const,
    },
    {
      title: "学完想达到什么目标？",
      options: [
        { value: "understand", label: "把原理搞明白" },
        { value: "apply", label: "会用大模型做应用" },
        { value: "engineer", label: "能做工程化部署" },
      ],
      key: "goal" as const,
    },
  ];

  if (step < steps.length) {
    const s = steps[step];
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-xs text-muted-foreground">
            第 {step + 1} / 4 题 · 随时可以重新测评
          </div>
          <h1 className="mt-2 text-lg font-bold text-foreground">{s.title}</h1>
          <div className="mt-5 flex flex-col gap-2">
            {s.options.map((o) => {
              const current =
                s.key === "hasMlBackground"
                  ? String(form.hasMlBackground)
                  : form[s.key];
              const active = current === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    if (s.key === "hasMlBackground") {
                      setForm({ ...form, hasMlBackground: o.value === "true" });
                    } else {
                      setForm({ ...form, [s.key]: o.value });
                    }
                  }}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    active
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-ring/60"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="text-muted-foreground"
            >
              上一题
            </Button>
            <Button onClick={() => setStep(step + 1)}>下一题</Button>
          </div>
        </div>
      </div>
    );
  }

  // 第 4 题：每周可投入时间
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="text-xs text-muted-foreground">第 4 / 4 题</div>
        <h1 className="mt-2 text-lg font-bold text-foreground">
          每周大概能投入多少小时？
        </h1>
        <input
          type="range"
          min={1}
          max={20}
          value={form.weeklyHours}
          onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
          className="mt-6 w-full accent-[oklch(0.511_0.237_277.8)]"
        />
        <div className="mt-2 text-center text-2xl font-bold text-primary">
          {form.weeklyHours} 小时 / 周
        </div>
        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => setStep(2)} className="text-muted-foreground">
            上一题
          </Button>
          <Button onClick={submit}>生成我的路径</Button>
        </div>
      </div>
    </div>
  );
}
