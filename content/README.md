# content/ — 内容资产目录（monorepo 子目录）

> 本目录是平台唯一内容事实源（Markdown），经质量流水线后由同步脚本写入数据库五集合。
> 依据：SPEC-content.md、开发设计文档 §4.3/§5。仓库根为 `D:\LLM_learning_v2`。

## 目录结构与命名

```
content/
├── README.md                      ← 本文件（格式规范唯一权威）
├── catalog.json                   ← 知识树定义（模块/章节的唯一事实源；id 为稳定 id）
├── scripts/
│   ├── parse-section.mjs          ← 唯一解析器 + deriveChunks（check/verify/sync 一律复用，禁止另写解析/切块）
│   └── check-frontmatter.mjs      ← 字段完整性检查（CLI，可传任意目录参数做夹具测试）
└── modules/
    └── <moduleCode>/              ← prep | core_principle | app | engineering（稳定 id，永不改名）
        └── <chapterCode>/         ← ch- 前缀（与 DB 章节 id 一致）
            └── <sectionId>.md     ← sec- 前缀（与 DB 小节 id 一致；进度/积分外键依赖它）
```

**命名铁律**：`sectionId` / `chapterCode` / `moduleCode` / 习题 `id` 一经发布永不改名——
`UserProgress`、`PointsLog.refId`、`WrongBook`、`KnowledgeChunk` 都以它们为外键。

## Frontmatter 字段字典

| 字段 | 类型 | 规则 | 说明 |
|---|---|---|---|
| `sectionId` | string | `^sec-[a-z0-9-]+$` | 小节稳定 id，= 文件名（无扩展名） |
| `title` | string | 非空 | 小节标题 |
| `moduleCode` | string | 四值枚举 | 所属模块 |
| `chapterCode` | string | `^ch-[a-z0-9-]+$` | 所属章节 |
| `difficulty` | string | `prep \| core \| advanced` | 映射：prep 模块→prep，engineering 模块→advanced，其余→core（DB 无此列，frontmatter 新增） |
| `sectionType` | string | `normal \| code_practice` | 代码实操小节影响完成判定（§8.2） |
| `estimatedMinutes` | int | 5–10 | 阅读时长（完成判定按 30% 校验） |
| `version` | string | `YYYY-MM` | 内容版本（公理1：时效性） |
| `sources` | string[] | ≥1 项 | 参考源溯源 |
| `codeVerified` | bool | — | 代码片段静态/CI 验证标记 |
| `codeLevel` | string | `A \| B \| C \| none` | 规则 3 代码分级：A=CI 必须实际跑通（此时 codeVerified 必须 true）；B=需 AutoDL 日志；C=静态检查；none=无代码或纯示意 |
| `verificationLog` | string | 仅 B 级，`verification/<sectionId>.log` | AutoDL 人工验证日志（入库留档，gitignore 已豁免该目录） |
| `reviewedBy` | string | `pending` 或审校人 id | **人工终审记录；`pending` = 未终审** |
| `lastReviewedAt` | string\|null | 终审时必填 `YYYY-MM-DD` | `reviewedBy=pending` 时必须为 `null`（诚实性规则，检查脚本强制） |
| `order` | int | 正整数 | 全局小节顺序（沿用 DB 语义，非章内顺序） |

YAML 子集约定：字符串一律双引号（仅转义 `\"` 与 `\\`），布尔/整数/`null` 裸写，列表用 `  - "项"` 两空格缩进。

## 正文与习题块格式

frontmatter 之后依次为：**正文**（逐字即入库的 `bodyMarkdown`）→（可选）`## 可选代码片段` → `## 随堂轻习题`。

- 保留小节标题 `## 随堂轻习题`、`## 可选代码片段` 不得出现在正文 body 内。
- 新创作内容请遵循 §4.3 模板结构（一句话直觉 → 核心讲解 → 可选代码 → 习题）；
  迁移批次（见下）保留原 seed 正文结构，属历史样例。

习题块语法（每题一个块，2–4 道）：

```markdown
### Q1 · single · ex-xxx-1        ← Q<序号> · <single|multi|judge> · <习题稳定id，ex- 前缀>
题干：<单行>
选项：
- A. <选项文本>
- B. <选项文本>
答案：B                            ← single/multi 用字母（multi 逗号分隔且 ≥2 项，如 A,C）
解析：<单行，温和语气>
知识点：<单行标签>

### Q2 · judge · ex-xxx-2
题干：<判断句>
选项：正确 / 错误                   ← judge 固定写法
答案：正确                         ← judge 用文字，入库还原为布尔
解析：…
知识点：…
```

## 工作流（对齐 SPEC-content / tasks/plan.md R1）

```
作者写/改 content/**/*.md（新章节先在 catalog.json 登记）
  → npm run content:check        （门禁一：字段完整性 + 诚实性 + 代码分级结构）
  → npm run content:sync 前自动跑门禁二（content-lint：规则 4/6/8/9 + 规则 3 静态项）
  → PR 触发 CI（.github/workflows/content-check.yml）：两道门禁 + A 级代码实际运行
  → 人工终审：reviewedBy 置审校人 id + lastReviewedAt（规则 7）
  → npm run content:sync         （单事务全量重灌五集合 + KnowledgeChunk 原子重建）
  → npm run content:verify       （DB ↔ Markdown 逐字段保真校验）
```

**词表唯一权威**：`scripts/copy-rules.mjs`（规则 4/6/9 词表 + §8.4 分层说明）。
规则 9 有意分层：评判/施压词（扣分/排名/清零…）全位置 error；「错误/失败/必须」在内容里为
warning（教学正文合法讨论错误率等概念），R4 前端 UI 字符串扫描时应升格为 error。

**同步语义**（`llm-platform/scripts/sync-content.ts`）：单事务先删后插，失败整体回滚；
确定性 chunk id（`chk-<sectionId>-<序号>`）保证幂等与事故归因；孤儿引用预检——
若同步会使用户反馈/错题本变成断链（内容删除而用户数据仍引用），中止并逐条列出，
绝不静默破坏用户数据。`--dry-run` 只打印计划；`--dir <path>` 可对副本演练。

## 迁移批次说明（2026-08-28）

由一次性脚本 `llm-platform/scripts/migrate-seed-to-content.ts` 从开发档 seed（dev.db）生成，共 **7 个小节 / 8 道习题**：

- 正文、代码片段、习题逐字保真，经 `llm-platform/scripts/verify-content-migration.ts` 与 DB 逐字段比对通过。
- 全部 `reviewedBy: "pending"`、`lastReviewedAt: null`——**这批内容尚未人工终审**，终审是独立任务（见 tasks/todo.md R1）。
- `codeVerified` 沿用 seed 值 `true`（样例内容已过静态检查；生产批次以 CI 结果为准）。
