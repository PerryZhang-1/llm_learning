# Spec: ui-design — 全站设计系统（Calm EdTech）

> 对齐：PRD 公理3（正反馈）/ 公理5（无评判）/ §9 体验准则；开发文档 §8.4 文案规范
> 现状：🔴 未开始（当前为裸 Tailwind 默认样式，shadcn/ui 已在开发文档 §2.1 选型但未安装）
> 来源：2026-08-28 前端风格评估结论 + 《GitHub 前端 UI 设计资源精选》资源映射

## Objective

建立并落地"温和教育风（Calm EdTech）"设计系统：视觉上零压力、正反馈有微动效、全站文案过 §8.4 禁用词扫描。让"温和、无评判"从产品哲学变成可感知的视觉语言。

## 风格定位（从公理推导，非审美偏好）

| 公理 | 视觉翻译 |
|---|---|
| 公理3 正反馈 | 完成小节 +10 分的克制微动效（一次性，非满屏庆祝） |
| 公理5 无评判 | 无红色叉号、无排名元素；进度只展示"已获得"；断签只强调"最高纪录" |
| 零压力 | 浅色、暖中性色（stone 系）、单一安静强调色（沿用 indigo）、大留白、rounded-xl、柔和阴影 |
| 公理4 结构化阅读 | 学习页正文大字号、舒适行高，Notion 级阅读体验 |
| §8.4 文案规范 | 禁打击/惩罚/排名词，替代词表落进生成规则与扫描脚本 |

明确排除：暗黑科技风（压抑+审判感）、企业后台风（Ant Design 感）、浮夸游戏化。

## 现状核对（2026-08-28）

- ⛔ shadcn/ui 未安装（package.json 无 radix/shadcn 依赖）
- ⛔ `globals.css` 仅黑白两色变量；`components/ui.tsx` 为手写裸组件（TopNav/useToast/Page）
- ⛔ Sonner / Motion（正反馈微动效）未引入
- ⛔ DESIGN.md 设计规范文件不存在
- ⛔ §8.4 禁用词自动化扫描脚本不存在

## Commands

```
Init:     npx shadcn@latest init && npx shadcn@latest add button card dialog toast progress badge
Add:      npm install sonner motion
Lint:     npm run lint
Scan:     node scripts/copy-scan.mjs（待建：§8.4 禁用词扫描）
```

## Project Structure

```
llm-platform/DESIGN.md                        → 设计规范唯一权威（tokens + 文案规范 + 动效规则）
llm-platform/src/components/ui/*              → shadcn/ui 组件（替代手写 ui.tsx，apiFetch/useAuthGuard 保留）
llm-platform/src/app/globals.css              → stone 底色 + 强调色 tokens（@theme inline）
llm-platform/scripts/copy-scan.mjs            → §8.4 禁用词扫描（CI 与本地共用）
```

## Code Style

- 颜色/圆角/阴影只用 DESIGN.md 的 token，不出现魔法值
- toast 一律 Sonner（温和文案），弹窗一律 shadcn Dialog
- 微动效只用于正反馈时刻（+10 分、勋章解锁、完成弹窗），时长 200–400ms、一次性

## Testing Strategy

- `copy-scan.mjs` 进 CI：全站用户可见文案零禁用词（词表与内容流水线规则 9 共用）
- 页面级视觉走查：五大页面截图逐一核对 token 一致性
- 交互走查：完成弹窗/答错解析/答疑限额/跳关气泡四类关键时刻的文案与动效

## Boundaries

- **Always**：新页面先用 DESIGN.md tokens；用户可见文案过扫描词表
- **Ask first**：更换强调色/字体；引入新组件库
- **Never**：出现排名、落后、扣分、清零类 UI 元素或文案；红色叉号做错误反馈（用温和中性提示）；超过一处的满屏庆祝动效；深色模式（V1 仅浅色）

## Success Criteria

- [ ] 五大页面（首页/测评/总览/学习/个人中心）+ 管理端视觉统一，均由 shadcn/ui + tokens 构建
- [ ] 全站文案扫描零禁用词（§8.4）
- [ ] 正反馈微动效三处到位：完成小节 / 勋章解锁 / 答题提交
- [ ] 改造顺序（投入产出比）：小节学习页 → 正反馈动效 → 学习总览 → 测评页 → 个人中心 → 管理端

## Open Questions

- 【已决 2026-08-28】**V1 仅浅色**：重建 tokens 时删除现有 `globals.css` 的 `prefers-color-scheme` 暗色分支，不定义暗色 tokens。
- cmdk（⌘K 跳小节）是否纳入 V1（契合跳关自由，但非闭环必需）？建议列为 P1 可选项。
