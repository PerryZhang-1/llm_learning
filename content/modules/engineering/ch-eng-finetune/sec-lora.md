---
sectionId: "sec-lora"
title: "LoRA 与 QLoRA：低秩微调的直觉"
moduleCode: "engineering"
chapterCode: "ch-eng-finetune"
difficulty: "advanced"
sectionType: "normal"
estimatedMinutes: 8
version: "2026-08"
sources:
  - "LoRA (Hu et al. 2021)"
  - "QLoRA (Dettmers et al. 2023)"
  - "datawhalechina/self-llm"
codeVerified: true
codeLevel: "A"
reviewedBy: "pending"
lastReviewedAt: null
order: 16
---

## 一句话直觉

全量微调一个 7B 模型，要更新 70 亿个参数。**LoRA** 的洞察是：模型适应新任务时，参数的变化量其实非常"低秩"——可以把它拆成两个很瘦的小矩阵来学。**只训练小矩阵，冻结大模型**，训练成本直接降一两个数量级。

## 低秩分解：两块小板子拼出改动量

原权重矩阵 W 是 `d × d` 的大方阵。LoRA 不动 W，而是学一个增量 `ΔW = B × A`，其中 B 是 `d × r`、A 是 `r × d`，秩 r 通常只取 8~64：

- 全量微调要训练 `d × d` 个参数
- LoRA 只训练 `2 × d × r` 个——当 d = 4096、r = 16 时，约为原来的 **0.4%**

推理时把 `ΔW` 加回 W 即可（或合并权重），**不增加任何推理延迟**。不同任务可以各学一套 LoRA 权重（每个只有几十 MB），按需切换——这就是"一个基座 + 多个轻量适配器"的玩法。

## QLoRA：在 LoRA 之上再省一档

LoRA 解决"训练多少参数"，QLoRA 解决"基座占多少显存"：把冻结的基座模型量化到 **4bit** 加载（7B 模型从 14GB 压到 4GB 左右），LoRA 部分仍用高精度训练。组合起来，单张消费级显卡就能微调 7B 级别的模型——这是 2023 年之后开源微调生态爆发的技术前提。

## 什么时候选微调，什么时候不选

微调适合：让模型学会特定的输出风格/格式、专有领域的话术、稳定的分类行为。不适合：往模型里"塞新知识"——知识类需求 RAG 通常更可靠（可更新、可溯源），训练既贵又容易把旧知识搅乱。先问"这是能力问题还是知识问题"，再决定动不动训练。

## 眼见为实

下面的代码用一个 8×8 的"权重矩阵"演示低秩分解：把 ΔW 拆成 8×2 与 2×8 两个小矩阵的乘积，对比需要训练的参数量——数字不会说谎。

## 可选代码片段

### 低秩分解的参数量对比

```python
d, r = 8, 2

delta_w = [[(i * j) % 5 * 0.1 for j in range(d)] for i in range(d)]  # 假想的权重改动量
A = [[(i + j) % 3 * 0.1 for j in range(r)] for i in range(d)]        # d × r
B = [[(i * j) % 4 * 0.1 for j in range(d)] for i in range(r)]        # r × d

def params_full():  return d * d
def params_lora():  return d * r + r * d

print("全量微调参数量:", params_full())
print("LoRA 参数量:   ", params_lora(), f"（约 {params_lora() / params_full():.1%}）")

# 乘回：BA 与 ΔW 形状相同——推理时直接合并，无额外延迟
BA = [[sum(B[i][k] * A[k][j] for k in range(r)) for j in range(d)] for i in range(d)]
print("BA 与 ΔW 形状一致:", len(BA) == d and len(BA[0]) == d)
```

## 随堂轻习题

### Q1 · single · ex-lora-1
题干：LoRA 微调时，原始的大权重矩阵 W 是？
选项：
- A. 被冻结不动，只训练低秩的小矩阵
- B. 每一步都从头随机初始化
- C. 删掉一半参数再训练
- D. 被复制十份分别训练
答案：A
解析：LoRA 的"低秩适应"就是冻结 W、只学增量 ΔW = B×A；这既是省算力的来源，也保证了基座能力不被破坏。
知识点：LoRA 原理

### Q2 · single · ex-lora-2
题干：QLoRA 在 LoRA 的基础上进一步做了什么？
选项：
- A. 把秩 r 提高到 256 以上
- B. 把冻结的基座模型量化到 4bit 加载
- C. 删掉了低秩分解
- D. 需要多卡并行才能跑
答案：B
解析：QLoRA = 4bit 量化基座 + 高精度 LoRA 训练，让单张消费级显卡也能微调 7B 级模型；秩的大小和它解决的问题（显存）无关。
知识点：QLoRA

### Q3 · judge · ex-lora-3
题干：想让模型掌握最新的行业知识，微调通常是比 RAG 更合适的方案。
选项：正确 / 错误
答案：错误
解析：知识类需求首选 RAG——可随时更新、可溯源；微调更适合学"风格、格式、行为"，且往参数里塞知识既贵又容易搅乱原有能力。
知识点：微调与 RAG 的选择
