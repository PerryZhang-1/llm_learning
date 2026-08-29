# Spec: content — 内容资产与质量流水线

> 对齐：开发文档 §4 / §5；PRD 公理1（内容正确性是生存底线）、公理2（筛选成本 > 理解成本）
> 现状：🟡 数据模型与样例内容已就位，流水线完全缺失（本项目剩余工作里风险最高的一块）

## Objective

产出并通过 9 条质量门禁的 40 个小节；所有代码片段 100% 本地验证可运行；每条知识可溯源、可复现、可回滚。用户端实现"零外网搜索"。

## 现状核对（2026-08-28）

- ✅ 五集合模型齐全，含 `version` / `sourceRefs` / `codeVerified` / `sectionType` 字段
- ✅ `prisma/seed.ts`：7 节样例内容（8 道习题），幂等（先清后插），习题答案仅服务端持有
- ✅ content/ 子目录已建（2026-08-28）：7 节全部迁移为 §4.3 Markdown（frontmatter + 正文 + 习题块），经 check-frontmatter 与 DB 逐字段保真校验；全部 `reviewedBy: "pending"` 待人工终审
- ⛔ 人工终审这 7 节迁移内容（reviewedBy 置名 + lastReviewedAt）
- ⛔ 9 条规则自动化（规则 4/6/8/9 静态检查、规则 3-A 代码 CI 运行）
- ⛔ 人工终审签名流（reviewedBy / lastReviewedAt 落库）
- ⛔ 合并后自动同步脚本（Markdown → 五集合全量重灌）+ KnowledgeChunk 原子重建
- ⛔ A 级代码每周定时回归 + 失败自动建工单 + 下架代码展示

## Commands

```
Seed:      npx prisma db seed
CI:        GitHub Actions（待建：PR 触发静态检查 + A 级代码运行）
同步脚本:  content/ → 解析 → 五集合（待建）
```

## Project Structure

```
content/（monorepo 子目录，与 llm-platform 平级；已定 2026-08-28）
  modules/m{1-4}/ch{X}/s{Y}.md   → 小节（§4.3 模板：Frontmatter + 先通俗后专业 + 代码 + 习题）
llm-platform/prisma/seed.ts      → 开发档样例（保留）
llm-platform/scripts/sync-content.ts（待建）→ 解析 Markdown 写入五集合 + 重建 KnowledgeChunk
.github/workflows/content-check.yml（仓库根，paths 过滤仅 content/** 触发）
```

## Code Style

内容侧为 Markdown + Frontmatter，字段命名与 §4.3 模板逐字一致；脚本侧沿用 TypeScript + Prisma 事务写法（先删后插需在单事务内，防半同步状态）。

## Testing Strategy

- CI 静态检查：规则 4（营销词表）/ 6（越界清单）/ 8（字数→阅读时长换算）/ 9（禁用文案词表，与 §8.4 共用词表）
- CI 运行验证：A 级代码块抽为独立脚本执行，输出存档；B 级代码 PR 必须附 AutoDL 验证日志，否则门禁拒绝合并
- 同步脚本：对 seed 数据做幂等性单测（重复执行结果一致）

## Boundaries

- **Always**：每条知识点 ≥2 权威源交叉验证后才可进入终审；版本字段 ≤12 个月
- **Ask first**：知识树结构变更（增删模块/章节）；引入新的参考源
- **Never**：直接搬运参考源内容（只允许原创重写）；上线未经人工终审（缺 reviewedBy）的内容；向量块与小节 version 不一致时提供答疑

## Success Criteria

- [ ] 40 节全部通过 9 条门禁，代码片段 100% 可运行
- [ ] 任一小节可回溯：version + sourceRefs + reviewedBy + lastReviewedAt 齐全
- [ ] 内容更新后 KnowledgeChunk 原子重建，旧向量零残留
- [ ] 每周回归重跑，失败自动创建内容工单并置 `codeVerified=false`（代码展示下架直至复检）

## Open Questions

- 【已决 2026-08-28】content 目录采用 **monorepo 子目录**（与 llm-platform 平级，仓库根即 D:\LLM_learning_v2，同日由 D:\LLM_learning 迁移）；CI 用 paths 过滤，仅 content/** 变更触发检查。
- 产能风险：40 节 vs ≥2 名审校人力，若不足先收敛主干模块 2/3 共 20 节（§13 预案）
