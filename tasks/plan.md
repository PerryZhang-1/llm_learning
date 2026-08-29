# Plan: 大模型自学平台 MVP 剩余工作实施计划

> 前置：CAPABILITY-MAP.md（模块索引）+ 七份 SPEC 已评审
> 范围：**只做缺口**——开发档已通链路不重做；每阶段有验证检查点，通过才进下一阶段

## 实施顺序与依赖

```
R1 内容流水线(content) ────────────┐
R2 生产基建(auth生产档+Postgres) ──┤
R4 UI 设计系统(ui-design) ─────────┤ 三线并行启动
                                   │
R3 答疑生产档(qa) ◄── 依赖 R1 首批内容入库 + R2 的 Postgres/pgvector
                                   │
R5 全站回归验收 ◄── 汇聚所有线
```

## R1 内容流水线（content，风险最高，周期最长）

**做法**：content/ 子目录（monorepo）+ 9 条规则自动化 + 同步脚本。首批先跑通"1 节内容从 Markdown 到数据库全链路"，再批量产内容。

1. ✅ 建 `content/` monorepo 子目录（§4.3 模板，稳定 id 命名 `modules/<moduleCode>/<chapterCode>/<sectionId>.md`）+ 迁移现有 7 节 seed 内容为 Markdown（2026-08-28 完成）
2. 同步脚本（Markdown → 五集合 + KnowledgeChunk 原子重建，单事务）
3. ✅ CI 静态检查（规则 4/6/8/9，词表与 §8.4 共用）+ A 级代码块运行验证（2026-08-29 完成）
4. 人工终审签名流（reviewedBy 落库）
5. 批量产出 → 每周回归任务

**风险**：内容产能（§13 预案：不足则先收敛模块 2/3 共 20 节）。
**检查点**：1 节内容走完全链路且可回溯（version/sourceRefs/reviewedBy 齐全）。

## R2 生产基建（auth + 部署形态）

1. Resend 真实发信 + 随机验证码 + 60s 频控 + 10min 有效期
2. 会话 Cookie 安全属性复查（HttpOnly/SameSite/Secure/过期）
3. 生产 `devCode` 泄漏验收
4. SQLite → PostgreSQL 切换（Neon/Supabase），schema 中 SQLite 特化字段回迁
5. Vercel 部署 + Sentry 接入

**检查点**：生产环境注册→登录→回访全链路手测清单通过。

## R3 答疑生产档（qa）

1. DashScope 嵌入接入（text-embedding-v3，1024 维）+ pgvector 余弦检索替换关键词匹配
2. 上下文预算裁剪（≤4K tokens 三级裁剪）
3. 系统提示词补全"不越阶 / 不输出完整项目代码"规则
4. 100 条标注集校准阈值 0.65
5. 监控三指标接入 Sentry（拒答率/幻觉抽检/Token 消耗）+ 新账号 5 次限制确认

**检查点**：200 条对抗样本幻觉率 ≤2%；第 21 次提问温和拦截且不耗 Token。

## R4 UI 设计系统（ui-design，与 R1-R3 并行）

1. shadcn/ui init + 基础组件集（button/card/dialog/toast/progress/badge）
2. DESIGN.md 落地（tokens + §8.4 文案规范 + 动效规则）
3. Sonner 替换手写 toast；Motion 接入三处正反馈微动效
4. 页面改造（按投入产出比）：小节学习页 → 反馈动效 → 总览 → 测评 → 个人中心 → 管理端
5. `copy-scan.mjs` 禁用词扫描进 CI

**检查点**：五大页面视觉统一 + 文案扫描零禁用词。

## R5 全站回归验收（收口）

按开发文档 §12 全量执行：功能验收（§12.1）+ 体验验收/公理级测试（§12.2）+ 三条终极判定（§12.3）。
gamification 的 Vitest 专项（幂等/封顶/断签边界）在本阶段前完成——它是 §12.2 的前置。

## 明确不做（防止范围蔓延，对齐附录 B）

在线代码沙盒、AI 简答题批改、社群/评论/社交、付费/等级/排名、移动端适配、证书体系、cmdk（列为 P1 可选）。

## 跨阶段约定

- 每条 PR 引用其实现的 SPEC 章节（skill 要求：spec 是活文档，决策变化先改 spec 再改码）
- 任务粒度：单任务 ≤5 文件、单次可完成、带验收标准与验证步骤 → 见 tasks/todo.md
