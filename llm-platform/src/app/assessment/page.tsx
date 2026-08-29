"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, useToast } from "@/components/ui";

/**
 * 入学测评页（§8.1）：四个温和的问题 → 生成个性化学习路径
 */
export default function AssessmentPage() {
  const router = useRouter();
  const { show, node } = useToast();
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
      show(data.message ?? "提交失败，请重试");
      return;
    }
    setResult(data.result);
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-3 text-xl font-bold text-slate-800">你的专属路径已生成</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{result.summary}</p>
          <button
            onClick={() => router.push("/tree")}
            className="mt-6 rounded-lg bg-indigo-600 px-8 py-3 font-medium text-white hover:bg-indigo-700"
          >
            去看知识树
          </button>
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <div className="text-xs text-slate-400">第 {step + 1} / 4 题 · 随时可以重新测评</div>
          <h1 className="mt-2 text-lg font-bold text-slate-800">{s.title}</h1>
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
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 disabled:opacity-30"
            >
              上一题
            </button>
            <button
              onClick={() => setStep(step + 1)}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              下一题
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 第 4 题：每周可投入时间
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      {node}
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="text-xs text-slate-400">第 4 / 4 题</div>
        <h1 className="mt-2 text-lg font-bold text-slate-800">每周大概能投入多少小时？</h1>
        <input
          type="range"
          min={1}
          max={20}
          value={form.weeklyHours}
          onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
          className="mt-6 w-full accent-indigo-600"
        />
        <div className="mt-2 text-center text-2xl font-bold text-indigo-600">
          {form.weeklyHours} 小时 / 周
        </div>
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setStep(2)}
            className="rounded-lg px-4 py-2 text-sm text-slate-500"
          >
            上一题
          </button>
          <button
            onClick={submit}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            生成我的路径
          </button>
        </div>
      </div>
    </div>
  );
}
