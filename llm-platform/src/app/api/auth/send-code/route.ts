import { NextResponse } from "next/server";
import { DEV_VERIFICATION_CODE } from "@/lib/session";

/**
 * 发送邮箱验证码（开发文档 §2.1 认证）
 * 开发环境：不真实发信，固定返回 123456，便于本地验证全链路
 * 生产环境：接入 Resend 发信 + 60 秒频控
 */
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, message: "邮箱格式不正确" },
      { status: 400 }
    );
  }

  // TODO(生产): Resend 发送 6 位随机验证码 + 频率限制
  return NextResponse.json({
    ok: true,
    message: "验证码已发送（开发模式固定为 123456）",
    devCode: process.env.NODE_ENV === "production" ? undefined : DEV_VERIFICATION_CODE,
  });
}
