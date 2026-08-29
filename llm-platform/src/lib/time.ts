// 时区统一：所有"日"的概念均为北京时间（Asia/Shanghai）—— 开发文档 §7.2 规则11

/** 当前北京时间的日期键 "YYYY-MM-DD" */
export function todayBJ(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 在日期键上加减天数（纯日历运算，用于断签判定） */
export function addDaysBJ(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}
