---
sectionId: "sec-attention-code"
title: "动手：用 10 行代码感受注意力"
moduleCode: "core_principle"
chapterCode: "ch-core-attention"
difficulty: "core"
sectionType: "code_practice"
estimatedMinutes: 10
version: "2026-08"
sources:
  - "LLMs-from-scratch (rasbt)"
codeVerified: true
codeLevel: "none"
reviewedBy: "pending"
lastReviewedAt: null
order: 4
---

## 代码先行

先展开下面的代码块读一遍，体会"点积 → softmax → 加权求和"这三步。

## 小结

这段代码就是注意力机制的最小骨架。真实的 Transformer 还加了缩放因子和掩码，但核心流程完全一样。

## 可选代码片段

### 最小注意力（伪 numpy 风格）

```python
# Q/K/V 都是向量序列（形状: 序列长度 x 维度）
scores = Q @ K.T              # 第一步：点积得到匹配分数
scores = scores / (d ** 0.5)  # 缩放：防止分数过大（真实实现有此步）
weights = softmax(scores)     # 第二步：归一化成权重
output = weights @ V          # 第三步：加权求和
```

## 随堂轻习题

### Q1 · single · ex-attn-code-1
题干：上面代码中，softmax 的作用是？
选项：
- A. 把分数变成 0~1 之间且和为 1 的权重
- B. 压缩向量维度
- C. 随机打乱顺序
- D. 去掉噪声
答案：A
解析：softmax 把任意实数分数归一化成概率分布（和为 1），这样才能当作"注意力权重"去加权 Value。
知识点：softmax
