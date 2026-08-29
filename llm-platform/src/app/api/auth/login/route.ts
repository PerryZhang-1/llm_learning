import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayBJ } from "@/lib/time";
import {
  SESSION_COOKIE,
  DEV_VERIFICATION_CODE,
  createSessionToken,
} from "@/lib/session";

/**
 * 验证码登录（开发文档 §2.1）
 * 用户不存在则自动注册（registeredDay = 当日，用于答疑新账号限流 §7.2 规则10）
 */
export async function POST(req: Request) {
  const { email, code, nickname } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof code !== "string") {
    return NextResponse.json({ ok: false, message: "参数缺失" }, { status: 400 });
  }
  // TODO(生产): 校验缓存中的真实验证码；开发模式固定 123456
  if (code !== DEV_VERIFICATION_CODE) {
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
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天，老用户直达学习总览
  });
  return res;
}
