# Spec: gamification — 激励引擎（只增不减）

> 对齐：开发文档 §6.2 / §6.3 / §9；PRD 公理3（微小高频正反馈 = 习惯养成）
> 现状：🟢 引擎已实现（points / badges / streak / wrongbook 四个 lib），专项测试未做

## Objective

全部激励只增不减：积分只增、勋章永不回收、`streakBest` 永不回退；错题无限重做不惩罚。数据库层无任何负向变动路径。

## 现状核对（2026-08-28）

- ✅ 数据层保证：`PointsLog.delta` 恒正 + 唯一约束幂等（userId+type+refId+dayKey）；`UserBadge` 无删除 API；`WrongBook.conquered` 永不回退
- ✅ `src/lib/points.ts` / `badges.ts` / `streak.ts` / `qa-quota.ts`
- 🟡 待专项验证（§9 规则逐条）：
  - 每日封顶：习题 ≤30/日、反馈 ≤15/日、单人总量 ≤200/日（`DailyPointCap`）
  - 惰性重置：答疑 20 次重置、连续学习更新、北京时间口径
  - 边界：23:59→00:01 计为连续两天；断签仅 `streakCurrent` 归 1，`streakBest` 不变
  - 新注册账号当日答疑限 5 次（`registeredDay` 字段已有，需确认 qa 路由消费了它）

## Commands

```
Test:       npx vitest run（待建）
Seed:       npx prisma db seed
```

## Project Structure

```
llm-platform/src/lib/points.ts    → 加分事务（幂等→封顶→加分→徽章检查）
llm-platform/src/lib/badges.ts    → badgeEngine.check(userId, event)
llm-platform/src/lib/streak.ts    → 惰性连续学习计算
llm-platform/src/lib/qa-quota.ts  → 答疑余量惰性重置
llm-platform/src/app/me/page.tsx  → 个人成长数据中心（只展示增长数据）
```

## Code Style

加分必须单事务完成（幂等检查 → 封顶检查 → 加分 → 徽章检查），并发重复提交不产生双倍积分；所有"日"的概念统一北京时间 `YYYY-MM-DD` 字符串。

## Testing Strategy

**本模块是 Vitest 单测的第一优先级**（纯逻辑多、边界多、是产品生命线）：

- 幂等：同用户+同类型+同对象+同日重复提交 → 仅 1 次加分
- 封顶：各分源达上限后动作仍正常记录（进度/错题本），仅不计分
- 断签边界：`lastActiveDay` 各场景枚举（当日重复 / 昨日 / 更早 / 首次）
- 跨天：23:59 与次日 00:01 连续学习判定
- 徽章：已拥有跳过（幂等写入）

## Boundaries

- **Always**：`delta > 0` 应用层硬校验；勋章判定幂等
- **Ask first**：积分规则数值调整；新增勋章类别
- **Never**：任何 `delta < 0` 的代码路径；删除/回收勋章的 API；文案出现"清零/中断/失败"

## Success Criteria

- [ ] 遍历全部积分规则，无任何负向变动路径（§12.1）
- [ ] 断签测试：`streakBest` 不回退、勋章不回收、积分不减少（§12.2）
- [ ] 脚本刷分：批量完成/重复提交/垃圾反馈，无效积分 = 0
- [ ] 前端永远同时展示 `streakCurrent` 与 `streakBest`，强调"最高纪录"

## Open Questions

- 积分用途（主题皮肤/资料解锁）V1 是否仅做占位不实现？（§9.1 提及，MVP 边界未明确）
