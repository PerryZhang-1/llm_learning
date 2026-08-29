# Spec: feedback — 内容反馈闭环与管理端

> 对齐：开发文档 §7.1（管理接口）/ §8.1（/admin）；PRD §6（用户反馈闭环，护城河组成部分）
> 现状：🟢 基础闭环已通

## Objective

用户发现问题随时提、有奖反馈、及时修复；管理端极简可用：`open → accepted → fixed` 状态流转，accepted 时发 +5 分（防垃圾反馈刷分）。

## 现状核对（2026-08-28）

- ✅ `/api/feedback`（提交）、`/api/admin/feedback`（列表）、`/api/admin/feedback/[id]`（状态流转）
- ✅ `/admin` 页面（独立受保护路由，不计入五大核心页面）
- ✅ 发分时机：确认 accepted 时才发放（`PointsLog.type=FEEDBACK`，走幂等与封顶）
- 🟡 管理端鉴权方式需确认（仅管理员角色可访问的判定逻辑）
- 🟡 用户侧"反馈状态可见"（个人中心展示处理进度）需回归

## Commands

```
Dev:  npm run dev
Lint: npm run lint
```

## Project Structure

```
llm-platform/src/app/admin/page.tsx                 → 极简管理端（反馈处理）
llm-platform/src/app/api/feedback/route.ts          → 提交反馈
llm-platform/src/app/api/admin/feedback/*           → 列表 / 状态流转
llm-platform/prisma/schema.prisma                   → Feedback（status: open|accepted|fixed|rejected）
```

## Code Style

状态流转由服务端强制（非法状态迁移拒绝）；发分复用 `points.ts` 事务（幂等：同一反馈只发一次）。

## Testing Strategy

- 单元：状态机合法性（open→accepted→fixed；非法迁移拒绝）、accepted 发分幂等
- 手测：提交 → 管理端可见 → 确认发分 → 用户可见状态变更（§12.1 对应验收条）

## Boundaries

- **Always**：accepted 发分走幂等事务；管理端操作留痕（状态 + 时间）
- **Ask first**：新增反馈类型/分类标签
- **Never**：open/rejected 状态发分；管理端无鉴权暴露；用户可见他人反馈

## Success Criteria

- [ ] 反馈全链路：提交 → 管理端可见 → 确认有效发 +5 → 修复后用户可见状态变更
- [ ] 垃圾反馈刷分路径封死（未确认不发分 + 每日封顶 15 分）
- [ ] 非管理员访问 /admin 与管理 API 被拒绝

## Open Questions

- 是否需要反馈去重/合并（同小节多人报同一问题）？V1 建议不做。
