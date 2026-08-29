# Capability Map: 大模型自学平台 MVP

> **方法论**：spec-driven-development skill（SPECIFY → PLAN → TASKS → IMPLEMENT，阶段门禁）
> **需求输入**：《第一性原理版｜大模型自学平台 MVP 正式PRD》《大模型自学平台 MVP 开发设计文档》
> **现状核对**：2026-08-28 对 llm-platform 源码逐模块核对（schema.prisma / qa.ts / middleware.ts / seed.ts / auth 路由）
>
> 本文件是**唯一模块索引**：模块 id 一经确定不再改名；每个模块的规格见 `SPEC-<module-id>.md`；
> 实施计划见 `tasks/plan.md`，任务清单见 `tasks/todo.md`。

---

## 模块总表

| 模块 id | 职责 | 依赖 | 现状（2026-08-28） | 规格 |
|---|---|---|---|---|
| `auth` | 邮箱验证码注册/登录、会话保持、IP 限流兜底 | — | 🟡 开发档可用（固定验证码 123456，未真实发信） | SPEC-auth.md |
| `content` | 知识树五集合数据模型、种子内容、内容质量流水线（9 条规则） | — | 🟡 骨架+7 节迁移✅、同步脚本✅、CI 门禁✅（规则 3/4/6/8/9 自动化）；剩人工终审与批量产出 | SPEC-content.md |
| `learning` | 测评分流、知识树总览、小节学习页、阅读进度、随堂习题 | auth, content | 🟢 开发档全链路已通，§8.2 交互规则待逐条回归 | SPEC-learning.md |
| `gamification` | 积分（只增不减）、勋章、连续学习、错题本 | learning | 🟢 引擎已实现，幂等/封顶/断签边界待专项测试 | SPEC-gamification.md |
| `qa` | AI 答疑（RAG 检索、三重约束、每日限流、降级） | auth, content, learning | 🟡 开发档可用（关键词检索降级）；缺嵌入/校准/监控 | SPEC-qa.md |
| `feedback` | 内容反馈闭环 + 极简管理端 | auth, content | 🟢 基础闭环已通 | SPEC-feedback.md |
| `ui-design` | 全站设计系统（Calm EdTech 视觉 + 温和文案） | 贯穿全部模块 | 🔴 未开始（当前为裸 Tailwind 默认样式） | SPEC-ui-design.md |

**依赖方向**（无环）：

```
auth ──→ learning ──→ gamification
  │          ▲
  │      content ──→ qa
  │          ▲   ▲
  └─→ feedback   learning
ui-design（横切：所有页面共用其 tokens 与组件规范）
```

## 构建顺序（剩余工作）

```
已完成基线（开发档闭环，保留不动）
   │
   ├─ R1 content（流水线补建）───────────── 风险最高、周期最长，最先启动
   ├─ R2 auth（生产档：真实发信+会话加固）─── 与 R1 并行
   ├─ R3 qa（生产档：嵌入+阈值校准+监控）─── 依赖 R1 首批内容入库、R2 基建定型
   ├─ R4 ui-design（设计系统+页面改造）──── 与 R1-R3 并行推进
   └─ R5 全站回归验收（§12 全量测试）────── 收口
```

## 门禁规则（skill 约定）

每个模块进入实现前，其 SPEC 必须经人工确认；模块间按上表依赖顺序推进，
被依赖模块的成功标准未验证前，依赖方不启动。

## 假设（未被需求文档明确、由本次梳理补充，有异议请指出）

1. 产出文档沿用项目现有中文语言。
2. 开发档（SQLite / 固定验证码 / 关键词检索降级）**保留**为可运行基线，生产化是增量切换而非重写。
3. `ui-design` 作为独立模块纳入（源于 PRD §9 体验准则 + 视觉升级需求），风格结论：Calm EdTech（温和浅色、shadcn/ui 基座）。
4. 测试框架选 **Vitest**（Next.js 生态默认倾向），E2E 暫不引入。
5. 现有代码视为"开发档已验收"，任务清单只列缺口，不重做已通链路。

## 决策记录

| 日期 | 决策 | 影响范围 |
|---|---|---|
| 2026-08-28 | content 采用 **monorepo 子目录 `content/`**（与 llm-platform 平级） | SPEC-content / plan R1 / todo R1 已同步；CI paths 过滤 |
| 2026-08-28 | 答疑嵌入走 **DashScope API**（text-embedding-v3，1024 维） | SPEC-qa / plan R3 / todo R3 已同步；与 pgvector `vector(1024)` 一致 |
| 2026-08-28 | **V1 仅浅色**，不做深色模式 | SPEC-ui-design / todo R4 已同步；重建 tokens 时删除暗色分支 |
| 2026-08-29 | **数据库切换 Neon PostgreSQL**（本地与生产同源），本地 dev.db 退役留作备份；R2 生产档完成（Resend 验证码 / 60s 频控 / 10min 过期 / 5 次作废 / crypto 随机码 / Cookie 加固） | SPEC-auth / SPEC-content 已同步 |
| 2026-08-29 | **答疑生产档完成**：嵌入 qwen3.7-text-embedding（实测 1024 维）+ 生成 qwen3.7-plus（Perry 指定）；pgvector 余弦检索，相似度阈值 0.65（距离 0.35）；上下文预算 4K；提示词补齐不越阶/不输出完整项目代码 | SPEC-qa 已同步 |
| 2026-08-28 | **项目根迁移至 `D:\LLM_learning_v2`**，全部文件以新根为准（原 D:\LLM_learning 保留副本，v2 验证通过后可删除） | 全部文档与 CI 路径以 v2 为准；node_modules/.next 未复制，在 v2 重装 |
