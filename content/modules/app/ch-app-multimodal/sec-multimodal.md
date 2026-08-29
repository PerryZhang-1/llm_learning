---
sectionId: "sec-multimodal"
title: "多模态基础：模型如何\"看\"一张图"
moduleCode: "app"
chapterCode: "ch-app-multimodal"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 6
version: "2026-08"
sources:
  - "ViT (Dosovitskiy et al. 2020)"
  - "CLIP (Radford et al. 2021)"
  - "mlabonne/llm-course"
codeVerified: true
codeLevel: "A"
reviewedBy: "pending"
lastReviewedAt: null
order: 13
---

## 一句话直觉

文字进模型前被切成 token；图片也一样——被切成一个个小方块（patch），每个方块编码成一个向量，然后与文字 token 排进**同一条队伍**。对模型来说，"看图"和"读字"在架构上是同一件事。

## Patch：图片的"token"

主流做法来自 ViT（视觉 Transformer）：把图片切成固定大小的小块（比如 16×16 像素），每块拉平后经线性投影变成一个向量——相当于一个"视觉 token"。一张 224×224 的图大约产生 196 个 patch。这些向量进入的同样是 Transformer，处理的同样是注意力——你在模块 2 学过的机制原封不动地搬到了图像上。

## 两个世界如何对齐

视觉编码器输出的是"图意向量"，语言模型吃的是"文字 token"，中间需要一个**对齐层**把两者接进同一表示空间。训练通常两步走：先用海量图文对做**对比学习**（CLIP 的思路：让配对的图文向量相互靠近、不配对的远离），再用图文指令数据微调出"看图对话"的能力。

## 能与不能

能：看图说话、图表问答、截图理解、文档信息抽取。仍易错：图内小字、精确数数、空间关系推理——关键场景下，让模型"先描述看到什么、再下结论"，或安排人工复核。

## 一个工程事实

图片是"贵"的输入：一张图的视觉 token 往往有几百上千个，成本与上下文占用远超一句话。多模态不是免费的，按需使用。

## 眼见为实

下面的代码用数字矩阵模拟一张 4×4 的"图片"，把它切成 2×2 的 patch、每块压缩成一个"视觉 token"——真实 ViT 的 patch 是 16×16 像素、压缩方式是线性投影加 Transformer，但"图 → patch 序列 → token"这个骨架一模一样。

## 可选代码片段

### 图片的 patch 化与视觉 token

```python
image = [
    [1, 2, 0, 3],
    [0, 1, 4, 1],
    [3, 0, 2, 2],
    [1, 1, 1, 0],
]

# 4x4 图像切成 2x2 的 patch：左上、右上、左下、右下
patches = [
    [row[c:c + 2] for row in image[r:r + 2]]
    for r in range(0, 4, 2)
    for c in range(0, 4, 2)
]

# 每个 patch 压缩成一个"视觉 token"（真实 ViT 用线性投影 + Transformer，这里用均值示意）
tokens = [round(sum(sum(row) for row in p) / 4, 2) for p in patches]

print("patch 数:", len(patches))
print("视觉 token 序列:", tokens)
```

## 随堂轻习题

### Q1 · single · ex-mm-1
题干：一张图片输入多模态模型后，它以什么形态参与计算？
选项：
- A. 逐个像素当作一个 token
- B. 被切成 patch，每块编码为一个向量，与文字 token 排进同一序列
- C. 先转成一段文字描述，再输入模型
- D. 压缩成一张缩略图保存
答案：B
解析：patch 化是多模态的标准入口——每个 patch 经编码器变成一个"视觉 token"，与文字 token 在同一条序列里被注意力一起加工；逐像素太长，转文字则丢失信息。
知识点：patch 化

### Q2 · judge · ex-mm-2
题干：CLIP 式对比学习的目标是让配对的图文向量相互靠近、不配对的远离。
选项：正确 / 错误
答案：正确
解析：这正是"两个世界对齐"的经典起手式——在海量图文对上学会"图和它配的文字在向量空间里挨在一起"，之后再用图文指令数据微调出对话能力。
知识点：对比学习

### Q3 · multi · ex-mm-3
题干：目前多模态模型仍然容易出错的场景是？（多选）
选项：
- A. 识别图内的小字
- B. 精确数出图里有几个物体
- C. 推理物体间的空间关系
- D. 根据一张漫画编一个小故事
答案：A,B,C
解析：小字、精确计数、空间推理是公认短板（patch 化丢细节 + 向量表示天然模糊）；D 属于看图生成，恰恰是它的强项。
知识点：能力边界
