import { PrismaClient } from "@prisma/client";

/** 测试用户创建：本机到 Neon 的链路偶发抖动，3 次重试兜底（CI 美区不需要） */
export async function createTestUser(
  prisma: PrismaClient,
  data: { email: string; nickname: string; registeredDay: string; qaResetDate: string }
) {
  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      return await prisma.user.create({ data });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}
