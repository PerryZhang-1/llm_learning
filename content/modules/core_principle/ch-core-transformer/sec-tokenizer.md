---
sectionId: "sec-tokenizer"
title: "Tokenizer 与词表：文字如何变成数字"
moduleCode: "core_principle"
chapterCode: "ch-core-transformer"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 6
version: "2026-08"
sources:
  - "LLMs-from-scratch (rasbt) ch2"
  - "HuggingFace NLP Course"
codeVerified: true
codeLevel: "A"
reviewedBy: "pending"
lastReviewedAt: null
order: 8
---

## 一句话直觉

模型不认识文字，只认识数字。**分词器（Tokenizer）**就是那个翻译官：一把剪刀加一本字典——把句子剪成小块（token），再按字典把每块换成编号。

## 词表：模型的"识字表"

**词表（vocabulary）**是分词器认识的全部 token 的编号目录。主流大模型的词表大约有几万到十几万条：GPT 系列约 5 万，Qwen 系列约 15 万。模型训练时学到的语言知识，都建立在这张编号表之上——它并不认识"大"这个字，只认识"大"对应的那个编号。

## 为什么是"子词"切分

按什么粒度切，是个两难：

- **按字切**：词表极小（中文常用字几千个），但序列很长，而且"模型"这样的词被拆成三个字，语义单元丢了
- **按词切**：语义完整，但词表会爆炸——语言里新词层出不穷，没见过的新词只能变成"未知"占位符

主流方案是**子词切分**（代表算法 BPE，字节对编码）：高频出现的片段合并成 token，罕见词拆成常见小块。比如 "unhappiness" 可能被切成 "un" + "happi" + "ness" 三块——常见的前后缀自己就是 token，新词几乎不会再"没见过"。中文常见字一般一字一 token，高频词语再按频率合并。

一个实用的量级感受：英文文本里 1 个 token 通常对应 0.75 个单词左右，一个常见英文单词约 1–2 个 token。

## 和你学过的内容接上

上一节的注意力机制，加工的正是这里的 token 编号序列：先查词表换成向量，再进 Transformer 反复加工。**分词器决定了模型"眼中的世界"**——它切得合不合理，直接影响模型的理解与生成质量。

## 一个容易踩的直观误区

两个意思相近的句子，token 数量可能差很多；反过来，两个对模型来说"长得很像"的 token 序列，含义可能毫不相干。看到模型对某些文字"格外迟钝或格外敏感"时，先看看分词器把它切成了什么，往往能解释一大半。

## 可选代码片段

### 字符级分词的最小示例（真实分词器是子词级）

```python
text = "大模型改变世界"

# 1. 建词表：每个字给一个编号（真实分词器的词表有几万到十几万条）
vocab = {ch: i for i, ch in enumerate(sorted(set(text)))}

# 2. 编码：文字变成 token 编号序列
ids = [vocab[ch] for ch in text]

# 3. 解码：编号序列还原成文字（编码必须可逆，模型才能输出人类语言）
inv = {i: ch for ch, i in vocab.items()}
print("词表:", vocab)
print("编码:", ids)
print("解码:", "".join(inv[i] for i in ids))
```

## 随堂轻习题

### Q1 · single · ex-tokenizer-1
题干：模型能直接理解"大模型"这三个字吗？
选项：
- A. 能，模型预训练时见过中文
- B. 不能，它只认识分词器给出的 token 编号
- C. 能，只要句子足够短
- D. 能，模型内置了中文字典
答案：B
解析：模型的世界里只有数字——文字先经分词器切成 token，再查词表换成编号，这一步之后"字"本身就不存在了。
知识点：token 化

### Q2 · multi · ex-tokenizer-2
题干：下面哪些是子词切分（BPE 类算法）带来的好处？（多选）
选项：
- A. 词表规模可控，不会随新词无限膨胀
- B. 见过词根的罕见词也能被合理切分，不再只能当"未知"
- C. 保证每个 token 都是一个完整单词
- D. 常见片段保持完整，罕见词才拆成小块
答案：A,B,D
解析：C 正好说反了——子词切分的出发点就是"完整单词不总是最优粒度"；A、B、D 都是其设计目标。
知识点：子词切分

### Q3 · judge · ex-tokenizer-3
题干：同一个句子，用不同的分词器切，得到的 token 数量一定相同。
选项：正确 / 错误
答案：错误
解析：分词器各有各的词表和切分策略，同句不同切是常态——这也是比较不同模型成本时，要看各自 token 计数而不是字数的原因。
知识点：分词器差异
