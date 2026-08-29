import { prisma } from "./db";
import { todayBJ } from "./time";
import { LOCAL_USER_EMAIL } from "./session";

/**
 * 答疑限流（开发文档 §6.3 + §7.2 规则10）
 * 惰性重置：请求时判断日期，无定时任务
 * 单一数据源：DB（qaRemainToday），边缘 IP 限流为兜底（见 middleware）
 */

const DAILY_QA_LIMIT = 20;
const NEW_ACCOUNT_DAILY_QA = 5; // 注册当日限 5 次，防批量注册薅 Token

export interface QaQuotaResult {
  ok: boolean;
  remain: number;
}

export async function consumeQaQuota(userId: string): Promise<QaQuotaResult> {
  const today = todayBJ();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, remain: 0 };
    if (user.email === LOCAL_USER_EMAIL) return { ok: true, remain: 9999 }; // 单机模式：答疑不限次

    let remain = user.qaRemainToday;
    if (user.qaResetDate !== today) {
      // 惰性重置：新注册账号当日 5 次，其余 20 次
      remain = user.registeredDay === today ? NEW_ACCOUNT_DAILY_QA : DAILY_QA_LIMIT;
      await tx.user.update({
        where: { id: userId },
        data: { qaResetDate: today, qaRemainToday: remain },
      });
    }
    if (remain <= 0) return { ok: false, remain: 0 }; // 温和拦截，不调用 LLM

    await tx.user.update({
      where: { id: userId },
      data: { qaRemainToday: remain - 1 },
    });
    return { ok: true, remain: remain - 1 };
    // 同 points.ts：事务超时加宽以适配 Neon 网络延迟
  }, { timeout: 30_000 });
}
