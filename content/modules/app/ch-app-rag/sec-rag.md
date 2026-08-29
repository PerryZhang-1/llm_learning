---
sectionId: "sec-rag"
title: "RAG：让模型先查资料再回答"
moduleCode: "app"
chapterCode: "ch-app-rag"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 8
version: "2026-08"
sources:
  - "datawhalechina/llm-universe"
codeVerified: true
codeLevel: "none"
reviewedBy: "pending"
lastReviewedAt: null
order: 6
---

## 为什么需要 RAG

大模型的知识有截止日期，也不知道你的私有资料。RAG（检索增强生成）的思路很简单：

> 先检索相关资料，把资料塞进提示词，再让模型基于资料回答。

## 三步流程

1. **索引**：文档切块 → 转成向量 → 存入向量数据库
2. **检索**：用户提问转向量 → 找出最相似的若干文档块
3. **生成**：把检索结果作为上下文交给模型生成回答

## 关键取舍

- 切块太大：检索不精准；切块太小：丢失上下文
- 检索质量决定回答上限——"垃圾进，垃圾出"

## 随堂轻习题

### Q1 · single · ex-rag-1
题干：RAG 中，决定回答质量上限的关键环节是？
选项：
- A. 模型的参数规模
- B. 检索到的资料质量
- C. 回答的排版
- D. 用户的打字速度
答案：B
解析：模型是基于检索到的资料作答的，检索不准则回答必然跑偏，所以说"检索质量决定回答上限"。
知识点：检索质量
