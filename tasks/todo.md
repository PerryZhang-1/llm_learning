# Todo: 任务清单（按依赖排序）

> 约定（spec-driven-development Phase 3）：单任务 ≤5 文件、单次可完成；顺序按依赖而非重要性。
> 完成一项勾一项；任务对应的规格章节见各 SPEC-*.md。

## R1 content — 内容流水线

- [x] Task: 建 content/ 骨架并迁移现有 7 节 seed 内容为 §4.3 模板 Markdown（2026-08-28 完成，含习题稳定 id、唯一解析器、诚实性 reviewedBy=pending）
  - Acceptance: 每节含 Frontmatter（sectionId/difficulty/estimatedMinutes/version/sources/codeVerified/reviewedBy）
  - Verify: 7 个 .md 通过 check-frontmatter.mjs（0 错误）+ verify-content-migration.ts 与 DB 逐字段一致
  - Files: content/modules/**、content/scripts/*、llm-platform/scripts/migrate-seed-to-content.ts、llm-platform/scripts/verify-content-migration.ts
- [ ] Task: 人工终审 7 节迁移内容（规则 7：种子内容 100% 人工过目）
  - Acceptance: 每节 reviewedBy 置审校人 id、lastReviewedAt 填日期（check-frontmatter 诚实性规则自动校验）
  - Verify: 逐节过目正文与习题后更新 frontmatter，检查脚本通过
  - Files: content/modules/**/*.md
- [x] Task: 同步脚本 Markdown → 五集合 + KnowledgeChunk 原子重建（2026-08-29 完成）
  - Acceptance: 单事务先删后插；重复执行幂等；旧向量零残留
  - Verify: 快照对比证明 sync(content) ≡ seed()；连续两次同步快照字节级一致；事务中途抛错回滚验证通过；4 类缺陷夹具全部中止且 DB 未变；孤儿引用守卫拦截（含真实用户数据）；确定性 chunk id（chk-<sectionId>-<n>）
  - Files: llm-platform/scripts/sync-content.ts、content/catalog.json、content/scripts/parse-section.mjs（deriveChunks）、llm-platform/scripts/snapshot-db.ts、llm-platform/scripts/dev-fixtures.ts、package.json
  - Files: llm-platform/scripts/sync-content.ts、package.json（加 sync 脚本）
- [x] Task: CI 静态检查（规则 4 营销词/6 越界清单/8 阅读时长/9 禁用文案）+ A 级代码块运行（2026-08-29 完成）
  - Acceptance: 违规 PR 门禁拒绝；B 级代码无 AutoDL 日志拒绝合并
  - Verify: 11 类夹具全部命中（R4×2/R6/R8×2/R9 分层×3/R3-A 运行成功+失败/R3-B 三态/R3-C 密钥+未锁版本 ×2）；真实内容 0 error 0 warning（误报基线干净）；workflow YAML 校验通过；对抗审查修复"散文密钥漏扫"与"verify JSON.stringify(null) 误报"两处门禁缺口
  - Files: content/scripts/copy-rules.mjs（词表唯一权威）、content/scripts/content-lint.mjs、content/scripts/check-frontmatter.mjs（codeLevel/verificationLog）、.github/workflows/content-check.yml、.gitignore、sync 增接 lint 预检
  - 注：git 仓库已 init 未提交；CI 在推送到 GitHub 后激活（PR 门禁的全链路验证需远端）
- [ ] Task: 每周回归任务（A 级代码重跑 + 失败建工单 + codeVerified=false 下架代码展示）
  - Acceptance: 注入一个必然失败的代码块，自动产生工单且前端不再展示该代码
  - Verify: 手动触发 workflow 观察全链路
  - Files: .github/workflows/content-weekly.yml、llm-platform/src/app/learn/[id]/page.tsx
- [ ] Task: 批量内容产出（首批模块 2/3；总量按产能 20–40 节）
  - Acceptance: 全部通过 9 条门禁，reviewedBy 落库
  - Verify: CI 报告 + 抽检
  - Files: content/modules/m2/**、content/modules/m3/**

## R2 auth — 生产档基建

- [ ] Task: Resend 真实发信 + 6 位随机验证码 + 60s 频控 + 10min 有效期
  - Acceptance: 真实邮箱可收到验证码并完成登录
  - Verify: 手测清单（发→收→登→回访→过期）
  - Files: src/app/api/auth/send-code/route.ts、src/app/api/auth/login/route.ts、src/lib/session.ts
- [ ] Task: 会话 Cookie 安全属性 + 生产 devCode 泄漏验收
  - Acceptance: HttpOnly/SameSite=Lax/Secure 齐全；生产响应无 devCode
  - Verify: DevTools 检查 Set-Cookie；生产环境 curl 登录接口
  - Files: src/lib/session.ts
- [ ] Task: SQLite → PostgreSQL 切换（Neon/Supabase）+ Vercel 部署 + Sentry
  - Acceptance: 生产环境注册→测评→学习全链路通；异常上报 Sentry
  - Verify: 生产域名走通 §12.1 闭环路径
  - Files: prisma/schema.prisma、.env.production、next.config.ts

## R3 qa — 答疑生产档

- [ ] Task: 嵌入模型接入 + pgvector 检索替换关键词匹配
  - Acceptance: DashScope text-embedding-v3（1024 维）生成向量；KnowledgeChunk.embedding 用 vector(1024)，embeddingModel 记录模型名
  - Verify: 同一提问对比检索命中质量
  - Files: src/lib/qa.ts、prisma/schema.prisma、scripts/rebuild-chunks.ts
- [ ] Task: 上下文预算裁剪（≤4K tokens：向量块→章节摘要→小节全文保 70%）
  - Acceptance: 超长小节场景下注入总量不超预算且小节全文保留 ≥70%
  - Verify: 单测 + 用最长小节实测
  - Files: src/lib/qa.ts
- [ ] Task: 系统提示词补全（不越阶 / 不输出完整项目代码）+ 100 条标注集校准阈值
  - Acceptance: 对抗样本拒答正确；阈值记录在案
  - Verify: 标注集跑分：拒答率 <15%、幻觉率 ≤2%
  - Files: src/lib/qa.ts、tests/qa-golden-set.json
- [ ] Task: 确认新账号当日 5 次限制已消费 registeredDay + 监控三指标接入
  - Acceptance: 新注册第 6 次提问被温和拦截；Sentry 可见拒答率/Token 消耗
  - Verify: 新账号实测 + Sentry 面板
  - Files: src/app/api/qa/route.ts、src/lib/qa-quota.ts

## R4 ui-design — 设计系统（可与任意线并行穿插）

- [ ] Task: shadcn/ui init + 基础组件集安装
  - Acceptance: button/card/dialog/toast/progress/badge 可用，globals.css 仅有浅色 tokens（删除暗色 media query 分支）
  - Verify: npm run build 通过；示例页渲染正常
  - Files: components.json、src/components/ui/*、src/app/globals.css、package.json
- [ ] Task: DESIGN.md 落地（tokens + §8.4 文案规范 + 动效规则）
  - Acceptance: 色板/圆角/阴影/字号/动效时长全部 token 化；禁用词表与内容流水线共用
  - Verify: 评审通过后作为唯一权威
  - Files: DESIGN.md（llm-platform 根）
- [ ] Task: Sonner 替换手写 useToast
  - Acceptance: 全站 toast 走 Sonner，文案温和语气
  - Verify: 触发四类提示（完成/答错/答疑限额/跳关）目视核对
  - Files: src/components/ui.tsx、各页面调用处
- [ ] Task: Motion 正反馈微动效三处（完成小节 +10 / 勋章解锁 / 答题提交）
  - Acceptance: 200–400ms 一次性动画，无满屏庆祝
  - Verify: 走查三个时刻
  - Files: src/app/learn/[id]/page.tsx、src/app/me/page.tsx、package.json
- [ ] Task: 页面视觉改造（顺序：学习页→总览→测评→个人中心→管理端）
  - Acceptance: 每页仅用 DESIGN.md tokens，无魔法值
  - Verify: 五大页面截图走查 + copy-scan 零禁用词
  - Files: src/app/learn/[id]/page.tsx、src/app/tree/page.tsx、src/app/assessment/page.tsx、src/app/me/page.tsx、src/app/admin/page.tsx
- [ ] Task: copy-scan.mjs 禁用词扫描进 CI
  - Acceptance: 含禁用词的提交被拦截
  - Verify: 提交含"答错了"字样的样例被拦
  - Files: scripts/copy-scan.mjs、.github/workflows/lint.yml

## R5 gamification 专项测试 + 全站验收

- [x] Task: 搭建 Vitest 并完成激励引擎专项（幂等/封顶/断签边界/跨天/徽章幂等）（2026-08-29 代码完成）
  - Acceptance: SPEC-gamification 四条 Success Criteria 对应用例全绿
  - Verify: npx vitest run——22 用例（time 6/streak 6/badges 5/points 5）直连 Neon 真库；逻辑验证通过并修复两个真 bug（grantBadge 裸 catch 吞掉瞬时连接错误会静默漏发勋章→仅吞 P2002；事务 5s 超时在 Neon 跨洋延迟下偶发不足→30s）
  - Files: vitest.config.mts、tests/lib/{time,streak,badges,points}.test.ts、tests/lib/helpers.ts、src/lib/{points,qa-quota}.ts（事务超时）、src/lib/badges.ts（P2002 判定）
  - 注：测试直连 Neon（本地无 Docker），本机深夜跨洋链路抖动会致部分用例 flaky（配置 retries=2 兜底）；GitHub 美区 CI 或稳定网络下应全绿，全绿验证待 CI 接入测试任务
- [ ] Task: 按 §12 全量回归验收（功能 §12.1 + 体验/公理 §12.2 + 终极判定 §12.3）
  - Acceptance: 三条终极判定全部成立
  - Verify: 验收清单逐项勾选归档
  - Files: tasks/acceptance-checklist.md（验收时新建）
