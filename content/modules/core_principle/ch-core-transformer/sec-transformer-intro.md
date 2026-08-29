---
sectionId: "sec-transformer-intro"
title: "大模型是怎么\"读\"文字的"
moduleCode: "core_principle"
chapterCode: "ch-core-transformer"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 8
version: "2026-08"
sources:
  - "LLMs-from-scratch (rasbt)"
  - "The Illustrated Transformer"
codeVerified: true
codeLevel: "none"
reviewedBy: "pending"
lastReviewedAt: null
order: 2
---

## 从文字到数字

模型不认识汉字，只认识数字。第一步是把文本切成 **token**（词元），再映射成向量。

比如"我爱学习"可能被切成 `我`、`爱`、`学习` 三个 token，每个 token 对应词表里的一个编号。

## 上下文是核心

同一个词在不同句子里意思不同。Transformer 的天才之处在于：让每个 token 在计算自己的表示时，**同时参考它周围的所有 token**。

这个"参考周围"的机制就是下一节的注意力（Attention）。

## 一句话总结

> 大模型 = 把文本变成向量序列，再用注意力机制反复加工这些向量的机器。

## 随堂轻习题

### Q1 · multi · ex-tf-1
题干：关于 token，下面说法正确的是？（多选）
选项：
- A. token 是文本被切分后的基本单位
- B. 一个 token 一定等于一个汉字
- C. 每个 token 会被映射成词表中的一个编号
- D. token 序列会被转成向量再进入模型
答案：A,C,D
解析：token 的粒度由分词器决定，可能是一个字、一个词，甚至半个词，所以"一定等于一个汉字"不对。其余三项是 token 化的标准流程。
知识点：token 化

### Q2 · judge · ex-tf-2
题干：Transformer 处理语言歧义的关键是：每个 token 会参考周围的 token 来计算自己的表示。
选项：正确 / 错误
答案：正确
解析：正确。注意力机制让每个位置结合上下文信息，这正是"同一个词在不同句子含义不同"能被处理的原因。
知识点：上下文建模
