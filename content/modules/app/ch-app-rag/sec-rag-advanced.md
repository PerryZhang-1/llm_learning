---
sectionId: "sec-rag-advanced"
title: "RAG 进阶：切块、重排与评估"
moduleCode: "app"
chapterCode: "ch-app-rag"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 7
version: "2026-08"
sources:
  - "datawhalechina/llm-universe"
  - "Cormack et al. 2009 (RRF)"
codeVerified: true
codeLevel: "A"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 14
---

## 承接：三步之后，质量差在哪

上一节讲了 RAG 的索引 → 检索 → 生成三步。真实项目里，把质量从"能用"提到"好用"，靠三件事：**切得好、检索得准、评估得清**。

## 切块：不是越碎越好

固定长度切法简单，但会把完整语义拦腰切断。更好的做法：**按文档结构**（标题、段落）切，块与块之间保留 10–20% 的**重叠（overlap）**，防止关键句恰好压在边界上。本平台的知识库就是这么切的——按小节的二级标题切块，保证每块语义完整。

## 检索：两路互补 + 重排

纯向量检索擅长语义相似，偶尔漏掉精准关键词；纯关键词检索相反。**混合检索**让两路都跑，再用 **RRF（倒数排名融合）**把两份排名合成一份：某文档在越多路线里排得越靠前，融合分就越高。粗筛之后通常再加一道**重排序（rerank）**：用更精细的模型把粗筛的 top-20 精排出 top-3，才交给生成。

## 评估：没有指标的调优是盲调

两个最基础的指标：检索侧看**命中率（recall@k）**——标准答案有没有被捞进候选；生成侧看**忠实度**——回答是否只基于检索到的资料。改切块、换嵌入模型、调参数，前后都要跑同一套测试问题对比，否则无法知道是变好了还是变坏了。

## 眼见为实

下面的片段实现 RRF 融合：两路检索各返回 3 个文档，融合后"两路都认可"的文档排到了第一位——这就是混合检索的价值。

## 可选代码片段

### 倒数排名融合（RRF）

```python
# 两路检索结果（文档 id，按各自相关度排序）：关键词路 vs 向量路
keyword_hits = ["d3", "d1", "d5"]
vector_hits = ["d2", "d1", "d4"]

def rrf(*result_lists, k=60):
    # 每个文档的融合得分 = Σ 1/(k + 该路的排名)
    scores = {}
    for hits in result_lists:
        for rank, doc in enumerate(hits, start=1):
            scores[doc] = scores.get(doc, 0) + 1 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

print("关键词路:", keyword_hits)
print("向量路  :", vector_hits)
print("融合后  :", rrf(keyword_hits, vector_hits))
```

## 随堂轻习题

### Q1 · single · ex-ragadv-1
题干：RRF（倒数排名融合）的打分逻辑是？
选项：
- A. 把两路结果的文档做并集，随机排序
- B. 文档在越多路里排名越靠前，融合分越高
- C. 只保留关键词路的结果，向量路做兜底
- D. 按文档标题的字典序排列
答案：B
解析：RRF 给每路结果按排名打"倒数分"再累加——一个文档若在两路里都靠前，得分会明显高过只被一路认可的文档。
知识点：RRF 融合

### Q2 · multi · ex-ragadv-2
题干：下面哪些是提升 RAG 检索质量的正确做法？（多选）
选项：
- A. 按文档结构切块，块间保留一定重叠
- B. 关键词与向量两路混合检索，再做重排序
- C. 建立固定评估集，每次调整前后都对比指标
- D. 上下文塞得越满越好，不用管块的大小
答案：A,B,C
解析：D 说反了——上下文窗口是预算，塞满噪声反而稀释关键信息；切块要保语义完整，检索要两路互补加精排，调优要有评估基线。
知识点：RAG 质量三板斧

### Q3 · judge · ex-ragadv-3
题干：没有评估集，也可以凭感觉可靠地调优 RAG 系统。
选项：正确 / 错误
答案：错误
解析：凭感觉调参无法区分"变好"和"碰巧"——固定测试问题 + 命中率/忠实度指标，是所有 RAG 调优的前提。
知识点：RAG 评估
