---
sectionId: "sec-vectorstore"
title: "向量库实战：把相似度检索用起来"
moduleCode: "engineering"
chapterCode: "ch-eng-vectorstore"
difficulty: "advanced"
sectionType: "normal"
estimatedMinutes: 7
version: "2026-08"
sources:
  - "datawhalechina/llm-universe"
  - "datawhalechina/self-llm"
codeVerified: true
codeLevel: "A"
reviewedBy: "pending"
lastReviewedAt: null
order: 17
---

## 一句话直觉

向量库做的事情一句话就能说完：**把所有文档变成向量存起来，查询时把问题也变成向量，找出"方向最接近"的几条**。本平台的 AI 答疑检索就是这么实现的——你提的每个问题都会被算成向量，和课程知识块比余弦相似度。

## 从零理解：向量、余弦、top-k

- **嵌入向量**：一段文字经过嵌入模型（模块 2 讲过 tokenizer，嵌入是它的下游）变成一串数字（如 1024 维）。语义相近的文字，向量方向也相近
- **余弦相似度**：衡量两个向量方向是否一致的分数，范围 -1 到 1，越接近 1 越相似。它只看"方向"不看"长度"，所以长文档和短问题的比较也公平
- **top-k 检索**：查询向量与库里所有向量算一遍相似度，取分数最高的 k 条——这就是"语义搜索"的全部

## 入门选型：先用简单的

真实项目里向量库选型是"从轻到重"：数据量小（几千条以内）直接用内存/数组计算甚至数据库的向量扩展；要持久化和过滤再上 **pgvector**（本平台的选择，复用 PostgreSQL 免多运维一个中间件）；千万级以上高并发才需要专用向量数据库。**不要一上来就引入重组件**——先让检索质量本身过关（模块 3 讲过的切块与评估），再谈规模。

## 和 RAG 的衔接

向量库只解决"找得到"，RAG 的完整质量还取决于：切块是否保语义、检索后有没有重排、生成是否忠实于资料。本平台的组合是 **pgvector + 按标题切块 + 相似度阈值过滤**（相似度低于阈值宁可坦诚说"没覆盖"，也不硬凑答案）。

## 眼见为实

下面的代码用 6 条"文档向量"手工搭一个最小向量库：把查询转成向量，算余弦相似度，取 top-2。数值全是手写的，方便你逐个核对相似度排序。

## 可选代码片段

### 最小向量库：余弦相似度 top-k

```python
import math

# 文档向量（真实场景来自嵌入模型；这里手工构造便于核对）
docs = {
    "doc-注意力":   [0.9, 0.8, 0.0, 0.1],
    "doc-词表":     [0.8, 0.9, 0.1, 0.0],
    "doc-RAG":      [0.0, 0.1, 0.9, 0.8],
    "doc-部署":     [0.1, 0.0, 0.8, 0.9],
}

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = math.sqrt(sum(x * x for x in a)), math.sqrt(sum(y * y for y in b))
    return dot / (na * nb)

query = [0.85, 0.85, 0.05, 0.05]  # 一次查询的嵌入向量
ranked = sorted(docs.items(), key=lambda kv: cosine(query, kv[1]), reverse=True)

for name, vec in ranked:
    print(f"{name}: 相似度 {cosine(query, vec):.3f}")
print("top-2 检索结果:", [name for name, _ in ranked[:2]])
```

## 随堂轻习题

### Q1 · single · ex-vs-1
题干：向量库做"语义搜索"的核心步骤是？
选项：
- A. 全文关键词逐字匹配
- B. 查询与文档都变成向量，按余弦相似度取 top-k
- C. 按文档标题的字母序筛选
- D. 把所有文档都喂给生成模型再挑好的
答案：B
解析：嵌入向量把语义变成了"方向"，余弦相似度只看方向不看长度，top-k 就是语义上最接近的 k 条——这就是语义搜索的全部骨架。
知识点：向量检索

### Q2 · judge · ex-vs-2
题干：项目一开始就应该引入专门的向量数据库，因为它的检索质量比其他方案好。
选项：正确 / 错误
答案：错误
解析：检索质量主要取决于嵌入模型、切块与重排，不是库本身；数据量小的时候 pgvector 甚至内存计算就够——先过质量关，再按规模升级选型。
知识点：选型原则

### Q3 · judge · ex-vs-3
题干：余弦相似度只比较两个向量的方向，不受向量长度影响。
选项：正确 / 错误
答案：正确
解析：余弦只算夹角；这保证了长文档和短问题在"方向一致性"上是公平的，这也是它成为语义检索标配的原因。
知识点：余弦相似度
