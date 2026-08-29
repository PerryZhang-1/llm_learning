import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * 入学测评（开发文档 §7.3 测评输出定义）
 * 输入：pythonLevel / hasMlBackground / goal / weeklyHours
 * 输出：推荐学习路径 + 每日建议时长；可重复提交（重新测评）
 */

const PYTHON_LEVELS = ["none", "basic", "proficient"] as const;
const GOALS = ["understand", "apply", "engineer"] as const;

interface AssessmentResult {
  pythonLevel: (typeof PYTHON_LEVELS)[number];
  hasMlBackground: boolean;
  goal: (typeof GOALS)[number];
  weeklyHours: number;
  recommendedPath: string[]; // 模块 code 序列
  skippedModules: string[]; // 可跳过的可选包
  dailyMinutes: number;
  summary: string;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pythonLevel = PYTHON_LEVELS.includes(body.pythonLevel) ? body.pythonLevel : "basic";
  const goal = GOALS.includes(body.goal) ? body.goal : "apply";
  const hasMlBackground = Boolean(body.hasMlBackground);
  const weeklyHours = Math.min(Math.max(Number(body.weeklyHours) || 5, 1), 40);

  // 路径推导规则（§7.3）：
  // - Python 零基础/基础 → 包含预备包；熟练 → 跳过预备包
  // - 有机器学习背景 → 预备包同样跳过（标注可略读）
  // - goal=engineer → 追加工程化包
  const recommendedPath: string[] = [];
  const skippedModules: string[] = [];
  if (pythonLevel === "none" || pythonLevel === "basic") {
    recommendedPath.push("prep");
  } else {
    skippedModules.push("prep");
  }
  if (hasMlBackground && pythonLevel === "proficient" && recommendedPath[0] === "prep") {
    skippedModules.push("prep");
    recommendedPath.shift();
  }
  recommendedPath.push("core_principle", "app");
  if (goal === "engineer") recommendedPath.push("engineering");

  const dailyMinutes = Math.max(15, Math.round((weeklyHours * 60) / 7 / 5) * 5);

  const result: AssessmentResult = {
    pythonLevel,
    hasMlBackground,
    goal,
    weeklyHours,
    recommendedPath,
    skippedModules,
    dailyMinutes,
    summary: buildSummary(pythonLevel, goal, dailyMinutes),
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { assessment: JSON.stringify(result) },
  });

  return NextResponse.json({ ok: true, result });
}

function buildSummary(
  pythonLevel: string,
  goal: string,
  dailyMinutes: number
): string {
  const parts: string[] = [];
  if (pythonLevel === "none") parts.push("我们从 Python 预备包开始，节奏放慢一些，不着急");
  else if (pythonLevel === "basic") parts.push("预备包可以挑不熟的部分快速过一遍");
  else parts.push("你的 Python 基础足够，直接从核心原理起步");
  if (goal === "engineer") parts.push("后续会带你走到工程化部署");
  else if (goal === "understand") parts.push("重点帮你把原理讲透");
  else parts.push("以动手应用为主线安排路径");
  parts.push(`建议每天投入约 ${dailyMinutes} 分钟，按自己的节奏来就好`);
  return parts.join("；") + "。";
}
