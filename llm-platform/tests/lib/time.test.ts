import { describe, expect, it } from "vitest";
import { addDaysBJ, todayBJ } from "../../src/lib/time";

/** 时间工具（规则 11：北京时间口径）——纯函数，边界即正确性 */
describe("time", () => {
  it("todayBJ 返回 YYYY-MM-DD 格式", () => {
    expect(todayBJ()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("addDaysBJ 跨月回退：3月1日 -1 → 2月最后一天", () => {
    expect(addDaysBJ("2026-03-01", -1)).toBe("2026-02-28"); // 2026 非闰年
  });

  it("addDaysBJ 跨年回退：1月1日 -1 → 上一年12月31日", () => {
    expect(addDaysBJ("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("addDaysBJ 闰年 2 月：2028-03-01 -1 → 02-29", () => {
    expect(addDaysBJ("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("addDaysBJ 跨月前进：1月31日 +1 → 2月1日", () => {
    expect(addDaysBJ("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("断签判定的关键档位：昨天 -1 = 前天、+1 = 今天", () => {
    const today = todayBJ();
    expect(addDaysBJ(today, -1)).not.toBe(today);
    expect(addDaysBJ(addDaysBJ(today, -1), 1)).toBe(today);
  });
});
