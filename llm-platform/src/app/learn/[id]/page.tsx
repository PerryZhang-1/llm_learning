"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/components/ui";

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
 * - 动效（DESIGN.md）：完成横幅与解析卡片为一次性 spring 动画
 */
export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<SectionData | null>(null);
  const [dwell, setDwell] = useState(0);
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
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
        const msg = res.awarded
          ? `太棒了，+${res.points} 分！${res.newBadges?.length ? "还获得了新勋章～" : ""}`
          : "已完成！继续保持节奏～";
        setCelebrate(msg);
        setTimeout(() => setCelebrate(null), 3200);
        setData({ ...data!, section: { ...data!.section, completed: true } });
      } else {
        toast(res.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitExercise(ex: Exercise) {
    const userAnswer = answers[ex.id];
    if (userAnswer === undefined) {
      toast("先选一个答案再提交哦");
      return;
    }
    const { data: res } = await apiFetch(`/api/exercises/${ex.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer: userAnswer }),
    });
    if (!res.ok) {
      toast(res.message);
      return;
    }
    setResults((r) => ({
      ...r,
      [ex.id]: { correct: res.correct, explanation: res.explanation, points: res.points },
    }));
    if (res.awarded) toast(`+${res.points} 分`);
    if (res.newBadge) toast("获得新勋章：错题征服者！");
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
        toast(res.message);
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
    toast(res.message ?? "提交没有成功，再试一次就好");
    if (res.ok) {
      setShowFeedback(false);
      setFeedbackText("");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="font-bold text-primary">
            大模型自学平台
          </Link>
          <span className="text-border">/</span>
          <span className="text-muted-foreground">
            {s.moduleName} · {s.chapterName}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            已阅读 {Math.floor(dwell / 60)}分{dwell % 60}秒
          </span>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_300px]">
        {/* 正文区 */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{s.title}</h1>
            {s.completed && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700">
                已完成
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            预计 {s.estimatedMinutes} 分钟 · 内容版本 {s.version} · 参考源：
            {s.sourceRefs.join("、") || "原创整理"}
          </p>

          <article className="prose prose-stone mt-6 max-w-none rounded-xl border bg-card p-6 shadow-sm">
            <ReactMarkdown>{s.bodyMarkdown}</ReactMarkdown>
          </article>

          {/* 代码片段（实操小节默认收起） */}
          {s.codeSnippets.length > 0 && (
            <div className="mt-6 space-y-3">
              {s.codeSnippets.map((c, i) => {
                const open = expandedSnippets.has(i);
                return (
                  <div key={i} className="rounded-xl border bg-card shadow-sm">
                    <button
                      onClick={() =>
                        setExpandedSnippets((prev) => {
                          const next = new Set(prev);
                          if (open) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                    >
                      <span>💻 {c.title ?? `代码片段 ${i + 1}`}</span>
                      <span className="text-xs text-primary">{open ? "收起" : "展开查看"}</span>
                    </button>
                    {open && (
                      <pre className="overflow-x-auto rounded-b-xl bg-zinc-900 p-4 text-xs leading-5 text-zinc-100">
                        <code>{c.code}</code>
                      </pre>
                    )}
                  </div>
                );
              })}
              {s.sectionType === "code_practice" && !allSnippetsExpanded && (
                <p className="text-xs text-muted-foreground">
                  把每个代码块都展开看一遍，再标记完成哦（还剩{" "}
                  {s.codeSnippets.length - expandedSnippets.size} 个）
                </p>
              )}
            </div>
          )}

          {/* 完成按钮 + 庆祝横幅（DESIGN.md 动效：一次性 spring） */}
          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={markComplete}
              disabled={busy || s.completed}
              className="px-6 py-3"
            >
              {s.completed ? "已完成 ✓" : busy ? "提交中…" : "我读完了，标记完成"}
            </Button>
            <Button variant="outline" onClick={() => setShowFeedback((v) => !v)} className="py-3">
              内容有问题？反馈
            </Button>
          </div>

          <AnimatePresence>
            {celebrate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700"
              >
                🎉 {celebrate}
              </motion.div>
            )}
          </AnimatePresence>

          {showFeedback && (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
              <Textarea
                rows={3}
                placeholder="告诉我们哪里有误（至少 10 个字，确认有效会加 5 分答谢）"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
              <Button size="sm" className="mt-2" onClick={submitFeedback}>
                提交反馈
              </Button>
            </div>
          )}

          {/* 习题区 */}
          {s.exercises.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-foreground">巩固练习</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                可以跳过，做错了也没关系，随时重做
              </p>
              <div className="mt-4 space-y-5">
                {s.exercises.map((ex, idx) => (
                  <div key={ex.id} className="rounded-xl border bg-card p-5 shadow-sm">
                    <p className="text-sm font-medium text-foreground">
                      {idx + 1}. {ex.question}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                        {ex.knowledgePoint}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {ex.options.map((opt, oi) => {
                        const val =
                          ex.type === "multi" ? oi : ex.type === "judge" ? oi === 0 : oi;
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
                            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                              selected
                                ? "border-primary bg-accent text-accent-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-ring/60"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Button size="sm" onClick={() => submitExercise(ex)}>
                        {results[ex.id] ? "再试一次" : "提交答案"}
                      </Button>
                      {results[ex.id] && (
                        <span
                          className={`text-sm font-medium ${
                            results[ex.id].correct ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {results[ex.id].correct ? "✓ 答对了" : "差一点点，看看解析"}
                        </span>
                      )}
                    </div>
                    <AnimatePresence>
                      {results[ex.id] && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="mt-3 rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground"
                        >
                          💡 {results[ex.id].explanation}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 侧栏：AI 答疑 */}
        <aside className="h-fit rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-16">
          <h3 className="font-bold text-foreground">🤖 AI 答疑助手</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            只基于课程内容回答（本机模式 · 不限次）
          </p>
          <Textarea
            className="mt-3"
            rows={3}
            placeholder="对本小节有什么疑问？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            onClick={askQa}
            disabled={qaBusy || !question.trim()}
            className="mt-2 w-full"
          >
            {qaBusy ? "思考中…" : "提问"}
          </Button>
          {qaAnswer && (
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-accent p-3 text-sm leading-6 text-accent-foreground">
              {qaAnswer.answer}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
