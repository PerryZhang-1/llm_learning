import { prisma } from "./db";
import { todayBJ } from "./time";

/**
 * 单机本地模式（2026-08-29 决策）：无登录体系。
 * 所有请求自动使用唯一的本地默认用户——进度/积分/错题本/勋章照常按用户记账（单用户）。
 * 邮箱验证码登录与 Resend 已随"去 Neon"决策一并移除（历史版本见 git 记录）。
 */

export const LOCAL_USER_EMAIL = "local@localhost";

/** 获取当前用户：单机模式下恒为本地默认用户（不存在则自动创建） */
export async function getCurrentUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: {
      email: LOCAL_USER_EMAIL,
      nickname: "本地用户",
      registeredDay: todayBJ(),
      qaResetDate: todayBJ(),
    },
  });
}

/** 单机模式：本机用户即管理员 */
export function isAdminEmail(_email: string): boolean {
  return true;
}
