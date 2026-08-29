# DESIGN.md — 全站设计规范（唯一权威）

> 风格定位：**Calm EdTech（温和教育风）**。从 PRD 公理推导：浅色、暖中性、大留白、克制正反馈。
> 所有页面/新组件必须使用本文件的 tokens，禁止出现魔法值（硬编码色值/圆角）。

## 一、色板（定义见 `src/app/globals.css`，全部为 token）

| Token | 值（oklch） | 用途 |
|---|---|---|
| `background` | 0.985 0.001 106（stone-50 暖白） | 页面底色 |
| `card` | 1 0 0（纯白） | 卡片/浮层 |
| `foreground` | 0.147 0.004 49.25（stone-950） | 主文字 |
| `muted-foreground` | 0.553 0.013 58.071 | 次要文字/说明 |
| `primary` | 0.511 0.237 277.8（indigo-600） | 唯一强调色：主按钮/链接/进度 |
| `ring` | 0.673 0.182 276.9（indigo-400） | 聚焦环 |
| `accent` | 0.961 0.013 277（indigo-50） | 选中态底、答疑回答框 |
| `destructive` | 0.577 0.245 27.325 | 仅限真正的错误兜底，不做装饰 |
| 完成态 | emerald（语义色，保留） | "已完成/已征服"正向信号 |

**禁用**：暗色模式（V1 仅浅色，决策记录 2026-08-28）；红色叉号做错误反馈；竞争性红色大块。

## 二、形态语言

- **圆角**：全局 `--radius: 0.75rem`；卡片一律 `rounded-xl border bg-card shadow-sm`
- **留白**：页面主列 `max-w-5xl px-4 py-8`；卡片内 `p-5/p-6`；区块间距 `mt-6+`
- **正文阅读**（学习页）：`prose` 排版插件 + `p-6`，正文即读即所得
- **导航**：`sticky top-0 z-10 bg-card/80 backdrop-blur border-b`
- **按钮**：一律用 shadcn `Button`（default=primary / outline / ghost / secondary），不再手写按钮样式
- **提示**：一律 `sonner` 的 `toast()`（底部居中、圆角），不再自研 toast

## 三、动效规则（Motion）

1. **只用于正反馈时刻**：完成小节（+10）、勋章解锁、答题提交反馈
2. **时长 200–400ms，一次性**：spring 弹入（`motion.div initial/animate`），禁止循环动画、禁止满屏庆祝
3. 实现：`motion/react` 的 `motion.div` + `AnimatePresence`；完成横幅 = scale 0.9→1 + fade；解析卡片 = y 8→0 + fade

## 四、文案规范（硬约束）

- 词表唯一权威：`content/scripts/copy-rules.mjs`
- UI 字符串按**全量档**执行：JUDGMENT_TERMS + CAUTION_TERMS 都不允许出现在 src/ 的用户可见文案里
- CI：`scripts/copy-scan.mjs` 扫描 `src/**/*.{ts,tsx}`；违规即红
- 答错提示用"差一点点，看看解析"（禁"答错了"）；提交未成功用"提交没有成功，再试一次就好"（禁"失败"）

## 五、新增页面检查单

- [ ] 颜色全部来自 token（bg-card/text-muted-foreground/…），无 slate-*/indigo-*/stone-* 原生类
- [ ] 按钮用 `Button`，提示用 `toast()`
- [ ] 新交互文案过 copy-scan
- [ ] 仅浅色，未引入 `prefers-color-scheme`
