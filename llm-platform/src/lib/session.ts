import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

// MVP 会话方案：HMAC 签名 Cookie（生产接入 Auth.js + 邮箱验证码，见开发文档 §2.1）
// 开发模式下验证码固定为 123456，便于本地验证全链路

const SECRET = process.env.AUTH_SECRET || "dev-only-secret";
export const SESSION_COOKIE = "llm_session";
export const DEV_VERIFICATION_CODE = "123456";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, email, iat: Date.now() })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined
): { userId: string; email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data?.userId) return null;
    return { userId: data.userId, email: data.email };
  } catch {
    return null;
  }
}

/** 获取当前登录用户（未登录返回 null） */
export async function getCurrentUser() {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

/** 极简管理端判定：邮箱含 admin 视为管理员（生产换正式角色系统） */
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase().includes("admin");
}
