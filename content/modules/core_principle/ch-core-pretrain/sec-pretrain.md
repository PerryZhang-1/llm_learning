---
sectionId: "sec-pretrain"
title: "预训练：模型是怎么\"炼\"出来的"
moduleCode: "core_principle"
chapterCode: "ch-core-pretrain"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 7
version: "2026-08"
sources:
  - "LLMs-from-scratch (rasbt) ch5"
  - "mlabonne/llm-course"
codeVerified: true
codeLevel: "A"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 9
---

## 一句话直觉

预训练就是一场规模空前的"接龙游戏"：把海量文本喂给模型，每次遮住下一个 token 让它猜，猜完对答案、调整参数——如此重复万亿级别次之后，语言的结构就"长"进了参数里。

## 自监督：标注成本为什么是零

监督学习需要人工标注答案，但预训练不用：**文本本身就是答案**。把"大模型改变世"喂进去，下一个字"界"就在原文里。这种"从数据自身构造考题"的方式叫**自监督学习**，它让预训练可以把语料规模做到接近整个互联网——这也是它威力惊人的根本原因。

## 训练在优化什么

模型的预测与真实的下一个 token 之间会计算一个差距（交叉熵损失），训练就是不断微调亿万参数让这个差距变小。全部语料过一遍叫一个 epoch，真实预训练会持续数周到数月、动用成百上千张 GPU 并行。

## 能力来自哪里：三要素

影响预训练效果的三大要素是**参数规模、数据量、算力**，且三者要相互匹配：参数大而数据少会"死记硬背"，数据多而算力不足则根本训不完。同代模型之间的差距，主要就体现在这三样的组合上。

## 眼见为实

下面的代码用十几行实现了一个 bigram（只看前一个字符）的迷你"语言模型"：统计语料里每个字后面最常接哪个字，然后从"模"出发连续预测。运行后你会发现它开始原地打转——**只看一个字的模型注定如此**；真实模型看的是前面全部 token（这正是注意力机制的价值），但"预测下一个 token"这个训练目标，与此完全相同。

## 接上你学过的

预训练的产物叫**基座模型（base model）**：它只擅长续写——你问它问题，它可能接着补出更多问题。让它学会"回答"，需要对齐训练（本模块后面会讲）。

## 可选代码片段

### bigram 迷你语言模型：预测下一个字

```python
from collections import Counter

corpus = "大模型很强大，模型学语言。语言模型看下一个字。"
table = {}
for a, b in zip(corpus, corpus[1:]):
    table.setdefault(a, []).append(b)

def predict(ch):
    cands = Counter(table.get(ch, []))
    return cands.most_common(1)[0][0] if cands else "？"

out, ch = "", "模"
for _ in range(6):
    ch = predict(ch)
    out += ch
print("bigram 模型续写:", out)
```

## 随堂轻习题

### Q1 · single · ex-pretrain-1
题干：预训练阶段，模型反复优化的根本任务是？
选项：
- A. 理解用户意图并给出有帮助的回答
- B. 预测文本中的下一个 token
- C. 判断两段文字哪个质量更高
- D. 学会拒绝有害请求
答案：B
解析：A、C、D 分别是后来对齐与奖励建模阶段的目标；预训练从头到尾只做一件事——接龙。不过正是这个简单目标，逼着模型学会了语法、事实和推理的雏形。
知识点：预训练目标

### Q2 · judge · ex-pretrain-2
题干：预训练语料需要人工逐条标注"标准答案"。
选项：正确 / 错误
答案：错误
解析：预训练是自监督学习——把文本自己当考题（遮住下一个 token 让模型猜），不需要人工标注，这也是它能把语料堆到互联网规模的底气。
知识点：自监督学习

### Q3 · multi · ex-pretrain-3
题干：影响预训练效果的三大要素是？（多选）
选项：
- A. 参数规模
- B. 数据量
- C. 算力
- D. 模型的发布日期
答案：A,B,C
解析：三要素要相互匹配才有效：参数大而数据少容易过拟合，数据多而算力不足则训练无法完成；"发布日期"本身不产生能力。
知识点：缩放三要素
