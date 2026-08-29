import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayBJ } from "@/lib/time";
import { SESSION_COOKIE, DEV_VERIFICATION_CODE, createSessionToken } from "@/lib/session";

/**
 * 验证码登录（生产档 R2）
 * - 有 RESEND_API_KEY：校验 VerificationCode（10 分钟过期、错 5 次作废、成功即焚）
 * - 无 key 的本地开发档：固定 123456（生产配置 key 后此路径自动关闭）
 * 用户不存在则自动注册（registeredDay = 当日，用于答疑新账号限流 §7.2 规则10）
 */

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(req: Request) {
  const { email, code, nickname } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string") {
    return NextResponse.json({ ok: false, message: "参数缺失" }, { status: 400 });
  }

  if (process.env.RESEND_API_KEY) {
    const record = await prisma.verificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
    if (!record) {
      return NextResponse.json({ ok: false, message: "请先获取验证码" }, { status: 401 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, message: "验证码已过期，重新发送一个吧" },
        { status: 401 }
      );
    }
    if (record.code !== code) {
      const attempts = record.attempts + 1;
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        await prisma.verificationCode.delete({ where: { id: record.id } });
        return NextResponse.json(
          { ok: false, message: "尝试次数有点多，请重新获取验证码" },
          { status: 401 }
        );
      }
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts },
      });
      return NextResponse.json({ ok: false, message: "验证码不正确，再核对一下" }, { status: 401 });
    }
    // 成功即焚
    await prisma.verificationCode.deleteMany({ where: { email } });
  } else if (code !== DEV_VERIFICATION_CODE) {
    // 本地开发档
    return NextResponse.json({ ok: false, message: "验证码不正确" }, { status: 401 });
  }

  const today = todayBJ();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      nickname:
        (typeof nickname === "string" && nickname.trim()) ||
        email.split("@")[0],
      registeredDay: today,
    },
  });

  const token = createSessionToken(user.id, user.email);
  const res = NextResponse.json({ ok: true, isNewUser: user.registeredDay === today });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // R2 会话加固
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天，老用户直达学习总览
  });
  return res;
}
