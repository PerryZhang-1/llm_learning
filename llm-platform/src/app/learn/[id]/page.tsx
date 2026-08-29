"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiFetch, useToast } from "@/components/ui";

interface Exercise {
  id: string;
  question: string;
  type: string;
  options: string[];
  knowledgePoint: string;
}
interface SectionData {
  ok: boolean;
  section: {
    id: string;
    title: string;
    bodyMarkdown: string;
    codeSnippets: { title?: string; code: string; note?: string }[];
    sectionType: string;
    estimatedMinutes: number;
    version: string;
    sourceRefs: string[];
    chapterName: string;
    moduleName: string;
    completed: boolean;
    exercises: Exercise[];
  };
}

/**
 * 小节学习页（§8.2）：
 * - 停留时长前端计时，服务端复核（≥30% 预估时长才计完成）
 * - 代码实操小节：代码块默认收起，全部展开后才允许标记完成
 * - 习题可跳过；对错均展示解析；无限重做
 * - 侧栏：AI 答疑 + 内容反馈入口
 */
export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { show, node } = useToast();

  const [data, setData] = useState<SectionData | null>(null);
  const [dwell, setDwell] = useState(0);
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // 习题作答状态
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<
    Record<string, { correct: boolean; explanation: string; points: number }>
  >({});

  // AI 答疑
  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState<{ answer: string; remainToday: number } | null>(null);
  const [qaBusy, setQaBusy] = useState(false);

  // 反馈
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  // 停留计时（§7.2 规则4 前端埋点）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setDwell((d) => d + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    apiFetch(`/api/sections/${id}`).then(({ data }) => setData(data as SectionData));
  }, [id]);

  if (!data?.section) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">加载中…</div>;
  }

  const s = data.section;
  const allSnippetsExpanded =
    s.codeSnippets.length === 0 || expandedSnippets.size === s.codeSnippets.length;

  async function markComplete() {
    setBusy(true);
    try {
      const { data: res } = await apiFetch(`/api/sections/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          dwellSeconds: dwell,
          codeBlocksExpanded: s.sectionType === "code_practice" ? allSnippetsExpanded : undefined,
        }),
      });
      if (res.ok) {
        show(
          res.awarded
            ? `太棒了，+${res.points} 分！${res.newBadges?.length ? "还获得了新勋章～" : ""}`
            : "已完成！继续保持节奏～"
        );
        setData({ ...data!, section: { ...data!.section, completed: true } });
      } else {
        show(res.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitExercise(ex: Exercise) {
    const userAnswer = answers[ex.id];
    if (userAnswer === undefined) {
      show("先选一个答案再提交哦");
      return;
    }
    const { data: res } = await apiFetch(`/api/exercises/${ex.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer: userAnswer }),
    });
    if (!res.ok) {
      show(res.message);
      return;
    }
    setResults((r) => ({
      ...r,
      [ex.id]: { correct: res.correct, explanation: res.explanation, points: res.points },
    }));
    if (res.awarded) show(`+${res.points} 分`);
    if (res.newBadge) show("获得新勋章：错题征服者！");
  }

  async function askQa() {
    if (!question.trim()) return;
    setQaBusy(true);
    try {
      const { data: res } = await apiFetch("/api/qa", {
        method: "POST",
        body: JSON.stringify({ question, sectionId: id }),
      });
      if (res.ok) {
        setQaAnswer({ answer: res.answer, remainToday: res.remainToday });
      } else {
        show(res.message);
      }
    } finally {
      setQaBusy(false);
    }
  }

  async function submitFeedback() {
    const { data: res } = await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ sectionId: id, content: feedbackText }),
    });
    show(res.message ?? "提交失败，请重试");
    if (res.ok) {
      setShowFeedback(false);
      setFeedbackText("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {node}
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="font-bold text-indigo-600">大模型自学平台</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">{s.moduleName} · {s.chapterName}</span>
          <span className="ml-auto text-xs text-slate-400">已阅读 {Math.floor(dwell / 60)}分{dwell % 60}秒</span>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_300px]">
        {/* 正文区 */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{s.title}</h1>
            {s.completed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">已完成</span>}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            预计 {s.estimatedMinutes} 分钟 · 内容版本 {s.version} · 参考源：{s.sourceRefs.join("、") || "原创整理"}
          </p>

          <article className="prose prose-slate mt-6 max-w-none rounded-xl bg-white p-6 shadow-sm">
            <ReactMarkdown>{s.bodyMarkdown}</ReactMarkdown>
          </article>

          {/* 代码片段（实操小节默认收起） */}
          {s.codeSnippets.length > 0 && (
            <div className="mt-6 space-y-3">
              {s.codeSnippets.map((c, i) => {
                const open = expandedSnippets.has(i);
                return (
                  <div key={i} className="rounded-xl bg-white shadow-sm">
                    <button
                      onClick={() =>
                        setExpandedSnippets((prev) => {
                          const next = new Set(prev);
                          if (open) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
                    >
                      <span>💻 {c.title ?? `代码片段 ${i + 1}`}</span>
                      <span className="text-xs text-indigo-500">{open ? "收起" : "展开查看"}</span>
                    </button>
                    {open && (
                      <pre className="overflow-x-auto rounded-b-xl bg-slate-900 p-4 text-xs leading-5 text-emerald-300">
                        <code>{c.code}</code>
                      </pre>
                    )}
                  </div>
                );
              })}
              {s.sectionType === "code_practice" && !allSnippetsExpanded && (
                <p className="text-xs text-slate-400">
                  把每个代码块都展开看一遍，再标记完成哦（还剩 {s.codeSnippets.length - expandedSnippets.size} 个）
                </p>
              )}
            </div>
          )}

          {/* 完成按钮 */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={markComplete}
              disabled={busy || s.completed}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {s.completed ? "已完成 ✓" : busy ? "提交中…" : "我读完了，标记完成"}
            </button>
            <button
              onClick={() => setShowFeedback((v) => !v)}
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-indigo-300"
            >
              内容有问题？反馈
            </button>
          </div>

          {showFeedback && (
            <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
              <textarea
                className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none"
                rows={3}
                placeholder="告诉我们哪里有误（至少 10 个字，确认有效会加 5 分答谢）"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
              <button
                onClick={submitFeedback}
                className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                提交反馈
              </button>
            </div>
          )}

          {/* 习题区 */}
          {s.exercises.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-slate-800">巩固练习</h2>
              <p className="mt-1 text-xs text-slate-400">可以跳过，做错了也没关系，随时重做</p>
              <div className="mt-4 space-y-5">
                {s.exercises.map((ex, idx) => (
                  <div key={ex.id} className="rounded-xl bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-700">
                      {idx + 1}. {ex.question}
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">
                        {ex.knowledgePoint}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {ex.options.map((opt, oi) => {
                        const val = ex.type === "multi" ? oi : ex.type === "judge" ? oi === 0 : oi;
                        const selected =
                          ex.type === "multi"
                            ? Array.isArray(answers[ex.id]) &&
                              (answers[ex.id] as number[]).includes(oi)
                            : answers[ex.id] === val;
                        return (
                          <button
                            key={oi}
                            onClick={() => {
                              if (ex.type === "multi") {
                                const arr = Array.isArray(answers[ex.id])
                                  ? [...(answers[ex.id] as number[])]
                                  : [];
                                const pos = arr.indexOf(oi);
                                if (pos >= 0) arr.splice(pos, 1);
                                else arr.push(oi);
                                setAnswers({ ...answers, [ex.id]: arr });
                              } else {
                                setAnswers({ ...answers, [ex.id]: val });
                              }
                            }}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${
                              selected
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => submitExercise(ex)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                      >
                        {results[ex.id] ? "再试一次" : "提交答案"}
                      </button>
                      {results[ex.id] && (
                        <span
                          className={`text-sm font-medium ${
                            results[ex.id].correct ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {results[ex.id].correct ? "✓ 答对了" : "答错了，没关系"}
                        </span>
                      )}
                    </div>
                    {results[ex.id] && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        💡 {results[ex.id].explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 侧栏：AI 答疑 */}
        <aside className="lg:sticky lg:top-16 h-fit rounded-xl bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800">🤖 AI 答疑助手</h3>
          <p className="mt-1 text-xs text-slate-400">
            只基于课程内容回答；今日剩余 {qaAnswer?.remainToday ?? "…"} 次
          </p>
          <textarea
            className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none"
            rows={3}
            placeholder="对本小节有什么疑问？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            onClick={askQa}
            disabled={qaBusy || !question.trim()}
            className="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {qaBusy ? "思考中…" : "提问"}
          </button>
          {qaAnswer && (
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-indigo-50 p-3 text-sm leading-6 text-slate-700">
              {qaAnswer.answer}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
