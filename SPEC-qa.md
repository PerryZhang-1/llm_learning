# Spec: qa — AI 答疑（三重强约束）

> 对齐：开发文档 §10；PRD 公理6（卡点是放弃导火索）、公理1（幻觉摧毁正确性）
> 现状：🟡 开发档可用（有真实降级路径），生产档缺嵌入/校准/监控

## Objective

卡点 0 等待兜底：只答平台已校验内容，未知坦诚告知；每日 20 次硬限流控成本；幻觉率 ≤2%、拒答率 <15%。

## 现状核对（2026-08-28）

- ✅ `src/lib/qa.ts`：检索 + OpenAI 兼容接口（qwen-turbo 默认）+ 无 Key 降级返回检索片段
- ✅ 系统提示词含核心禁止规则（只答资料内、不闲聊、温和语气）；小节上下文注入（截断 1500 字符）
- ✅ `src/lib/qa-quota.ts` 用户级惰性重置；middleware IP 兜底
- ⛔ 嵌入模型（DashScope text-embedding-v3）+ pgvector 余弦检索（当前为关键词匹配降级，`embeddingModel="none"`）
- ⛔ 上下文预算裁剪（≤4K tokens：先裁向量块 → 再裁章节摘要 → 小节全文保 70%）
- ⛔ 不越阶规则（检测高阶主题→引导开高阶包）与"不输出完整项目代码"规则未在提示词中
- ⛔ 相似度阈值 0.65 + ≥100 条标注集校准；拒答率/幻觉抽检/Token 消耗监控
- 🟡 新账号当日限 5 次：`registeredDay` 字段已有，需确认 `/api/qa` 路由已消费

## Commands

```
Dev:   npm run dev
Env:   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / DASHSCOPE_API_KEY（嵌入，.env 仅服务端）
```

## Project Structure

```
llm-platform/src/lib/qa.ts        → 检索 + 生成 + 降级（生产档替换 retrieve 为向量检索）
llm-platform/src/lib/qa-quota.ts  → 每日余量（限流判断在 LLM 调用之前）
llm-platform/src/app/api/qa/route.ts   → 入口（鉴权 + 限流 + 上下文构建）
llm-platform/prisma/schema.prisma      → KnowledgeChunk（生产切 pgvector vector(1024)）
```

## Code Style

限流判断必须在 LLM 调用**之前**（余量 ≤0 → 温和拦截，不调用、不消耗 Token）；LLM 调用失败返回降级而非报错；答案永不编造（无来源 → 明确说"课程暂未覆盖"）。

## Testing Strategy

- 单元：配额惰性重置边界（跨天、新账号 5 次）、上下文裁剪优先级
- 上线前：≥100 条标注问答集（应答/应拒答两类）校准阈值 0.65
- 上线后监控：拒答率 <15%、幻觉抽检 ≤2%（周频）、日均 Token；Sentry 打标签可归因到具体 chunk

## Boundaries

- **Always**：限流前置；回答附来源小节 id（前端一键回看）；超范围时附"该内容超出当前小节范围"
- **Ask first**：更换嵌入/生成模型（KnowledgeChunk 记录模型版本，更换前重跑标注集）
- **Never**：回答知识库外内容时编造；闲聊；直接讲解高阶包内容；输出完整大型项目代码；限流绕过路径存在

## Success Criteria

- [ ] 200 条对抗样本（知识库外/闲聊/越阶/索要完整项目）幻觉率 ≤2%，每条可归因
- [ ] 第 21 次提问准确拦截且不消耗 Token（§12.1）
- [ ] 拒答率 <15%（过高则下调阈值 + 加大章节上下文注入）
- [ ] 新注册账号当日 5 次、次日起 20 次

## Open Questions

- 【已决 2026-08-28】嵌入走 **DashScope API**（text-embedding-v3，1024 维，与生产 pgvector `vector(1024)` 设计一致），免自托管；密钥仅存服务端环境变量。
- 答疑是否需要流式输出（§13 提及，影响前端交互）？
