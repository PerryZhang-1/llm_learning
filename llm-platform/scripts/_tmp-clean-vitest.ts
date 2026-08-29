import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: "vitest-" } }, select: { id: true } });
  for (const u of users) {
    await prisma.pointsLog.deleteMany({ where: { userId: u.id } });
    await prisma.dailyPointCap.deleteMany({ where: { userId: u.id } });
    await prisma.userProgress.deleteMany({ where: { userId: u.id } });
    await prisma.userBadge.deleteMany({ where: { userId: u.id } });
    await prisma.wrongBook.deleteMany({ where: { userId: u.id } });
    await prisma.feedback.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  console.log(`清理孤儿测试用户 ${users.length} 个`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
