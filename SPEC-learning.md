# Spec: learning — 测评与学习闭环

> 对齐：开发文档 §7.3 / §8.1 / §8.2；PRD 公理4（结构化 > 碎片化）、公理5（讨厌被评判）
> 现状：🟢 开发档全链路已通（本模块是所有模块里完成度最高的）

## Objective

注册 → 测评 → 学习 → 练习闭环无断点；测评无分数无评级、仅做偏好分流；跳关零拦截；阅读完成判定服务端可复核。

## 现状核对（2026-08-28）

- ✅ 页面：`/assessment`、`/tree`、`/learn/[id]`、`/`（总览）
- ✅ API：`/api/assessment`、`/api/tree`、`/api/sections/[id]`、`/api/sections/[id]/complete`、`/api/exercises/[id]/submit`
- ✅ 可选包开关 `/api/me/packs`（仅控展示，不动进度）
- 🟡 §8.2 交互规则需逐条回归：
  - 停留时长校验（≥ estimatedMinutes × 30%，未达标返回"不急，慢慢看～"）
  - 代码实操小节判定（展开全部代码块 + 提交 1 道代码理解题）
  - 答错文案模板（肯定尝试 + 知识点解析 + 一键回看，无"错误/失败"字样）
  - 跳关温和气泡（仅提示一次，不拦截）

## Commands

```
Dev:  npm run dev
Lint: npm run lint
```

## Project Structure

```
llm-platform/src/app/assessment/page.tsx   → 5 题偏好测评（无分数）
llm-platform/src/app/tree/page.tsx         → 知识树总览 + 可选包开关
llm-platform/src/app/learn/[id]/page.tsx   → 小节学习页（正文/代码/习题/答疑/反馈入口）
llm-platform/src/app/api/assessment/route.ts        → 测评输出 §7.3 结构化 JSON
llm-platform/src/app/api/sections/[id]/*            → 详情 / 完成上报
llm-platform/src/app/api/exercises/[id]/submit/*    → 判分（答案永不下发）
```

## Code Style

测评结果必须是 §7.3 的结构化 JSON（`pythonLevel` / `goal` / `startSectionHints` / `suggestPrepPack`），禁止自由文本；推荐路径仅做默认排序与高亮，永不产生硬锁。

## Testing Strategy

- Vitest 单元：停留时长判定边界（30% 上下）、多选题"漏选算错但不惩罚"判分、测评 JSON 结构
- 手测：跳关路径遍历、断网重进恢复进度

## Boundaries

- **Always**：完成上报携带前端停留时长并由服务端复核；习题答案仅服务端持有
- **Ask first**：测评题目变更（影响分流结果）；完成判定规则调整
- **Never**：返回答案字段给前端；任何形式的跳转拦截或关卡锁；进度数据因测评/开关操作被删除

## Success Criteria

- [ ] §8.2 四条交互规则逐条通过（含未达标时的温和文案）
- [ ] 任意小节可直达，仅温和提示一次
- [ ] 测评输出为 §7.3 结构化 JSON，重测不影响已有进度与积分勋章
- [ ] 注册→测评→学习→做题全链路无断点（§12.1）

## Open Questions

- 停留时长的"累计"口径（切页面暂停还是连续计时）需在实现处统一注释说明。
