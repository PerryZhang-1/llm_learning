---
sectionId: "sec-prompt"
title: "写好 Prompt 的三原则"
moduleCode: "app"
chapterCode: "ch-app-prompt"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 7
version: "2026-08"
sources:
  - "microsoft/generative-ai-for-beginners"
codeVerified: true
codeLevel: "none"
reviewedBy: "pending"
lastReviewedAt: null
order: 5
---

## 原则一：明确角色与任务

```
你是一位耐心的数学老师，请用初中生能懂的语言解释勾股定理。
```

比"解释一下勾股定理"稳定得多。

## 原则二：给出格式要求

要 JSON 就要 JSON 的字段说明；要列表就指明条目数量。模型的输出格式是"要出来的"，不是"猜出来的"。

## 原则三：提供示例（few-shot）

给 1~2 个输入输出示例，模型模仿示例的能力远强于理解抽象描述的能力。

## 常见误区

- 一次性塞入太多要求 → 拆成多轮
- 期望模型记住上一轮所有细节 → 关键信息重复给

## 随堂轻习题

### Q1 · single · ex-prompt-1
题干：想稳定获得 JSON 格式的输出，最有效的做法是？
选项：
- A. 在提示里明确写出字段与格式要求
- B. 多问几遍碰运气
- C. 把温度调到最高
- D. 先问模型会不会输出 JSON
答案：A
解析：输出格式需要在提示中显式约定（字段名、结构、示例），模型不会"自动猜"出你想要的格式。
知识点：格式控制
