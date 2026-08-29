import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * 发送邮箱验证码（生产档 R2）：
 * - 随机 6 位数字码，10 分钟过期（VerificationCode.expiresAt）
 * - 60 秒重发频控（同邮箱最近一封的 createdAt）
 * - Resend 真实发信；未配置 RESEND_API_KEY 时保留本地开发档（固定 123456）
 */

const RESEND_API = "https://api.resend.com/emails";
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: "邮箱格式不正确" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;

  // 本地开发档：无 key 时固定验证码（配置 key 后此路径自动关闭）
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      message: "验证码已发送（开发模式固定为 123456）",
      devCode: process.env.NODE_ENV === "production" ? undefined : "123456",
    });
  }

  // 60 秒重发频控
  const recent = await prisma.verificationCode.findFirst({
    where: { email, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
  });
  if (recent) {
    return NextResponse.json(
      { ok: false, message: "发送有点频繁，请 1 分钟后再试" },
      { status: 429 }
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0"); // 密码学随机
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // 旧码全部作废，写新码
  await prisma.verificationCode.deleteMany({ where: { email } });
  await prisma.verificationCode.create({ data: { email, code, expiresAt } });

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "onboarding@resend.dev",
      to: [email],
      subject: "大模型自学平台 · 登录验证码",
      html: `<p>你的登录验证码是：</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>
<p style="color:#888;">10 分钟内有效。如果不是你本人操作，忽略这封邮件就好。</p>`,
    }),
  });

  if (!res.ok) {
    // 不透出上游细节，只给温和提示（上游原因可在服务端日志补充）
    return NextResponse.json(
      { ok: false, message: "邮件发送没有成功，稍等一下再试，或检查邮箱地址是否写对" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "验证码已发送，请查收邮箱（10 分钟内有效）",
  });
}
