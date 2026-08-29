---
sectionId: "sec-attention"
title: "注意力机制：查询、键、值"
moduleCode: "core_principle"
chapterCode: "ch-core-attention"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 9
version: "2026-08"
sources:
  - "Attention Is All You Need"
  - "mlabonne/llm-course"
codeVerified: true
codeLevel: "none"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 3
---

## Q、K、V 三兄弟

注意力机制用三个角色工作：

- **Query（查询）**：我在找什么信息
- **Key（键）**：我这里有什么信息的"标签"
- **Value（值）**：我实际能提供的信息

类比图书馆找书：你带着需求（Query）对照每本书的索引标签（Key），匹配度决定你读哪本书的正文（Value）。

## 计算流程

1. Query 与所有 Key 做点积 → 得到"匹配分数"
2. 分数经过 softmax 归一化 → 变成注意力权重
3. 用权重对所有 Value 加权求和 → 输出

分数越高的位置，对输出的影响越大。

## 随堂轻习题

### Q1 · single · ex-attn-1
题干：在注意力机制中，决定"从哪些位置取多少信息"的是？
选项：
- A. Value 本身
- B. Query 与 Key 的点积分数（经 softmax）
- C. token 的原始编号
- D. 随机数
答案：B
解析：Query 与 Key 的点积衡量匹配程度，经过 softmax 变成权重，再用于加权 Value。这就是注意力权重的由来。
知识点：注意力权重
