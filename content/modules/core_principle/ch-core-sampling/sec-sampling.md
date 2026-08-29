---
sectionId: "sec-sampling"
title: "采样策略：temperature、top-p 与幻觉的成因"
moduleCode: "core_principle"
chapterCode: "ch-core-sampling"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 7
version: "2026-08"
sources:
  - "OpenAI Text generation guide"
  - "HuggingFace generation strategies"
  - "mlabonne/llm-course"
codeVerified: true
codeLevel: "A"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 10
---

## 一句话直觉

模型每次吐出 token 之前，手里都握着一张"候选概率表"。**采样策略**决定怎么用这张表：永远选分最高的，还是掷一个有偏的骰子——你感受到的"发挥稳定"与"脑洞大开"，差别就在这里。

## 从分数到概率：temperature

模型给每个候选 token 打一个分数（logit），**temperature** 控制分数变成概率时的"尖锐程度"：

- **调低**（如 0.2）：高分者几乎通吃，输出稳定保守，适合代码与事实问答
- **调高**（如 1.5）：概率被抹平，冷门候选也有机会，输出发散有创意，也更容易跑偏
- 工程上把 temperature 设为 0 视作"每次都选最高分"（贪心解码）

## 两条刹车：top-k 与 top-p

- **top-k**：只保留分数最高的 k 个候选，其余一律排除。简单直接，但 k 是固定的
- **top-p（核采样）**：按概率从高到低累加，累加到 p（如 0.9）就停，候选数量随分布自动伸缩——目前更常用

两者做的是同一件事：把长尾里明显不靠谱的候选剪掉，再在剩下的里面重新分配概率。

## 幻觉的成因：它优化的是"像"，不是"真"

理解了采样，幻觉就不再神秘：预训练的目标是预测"下一个最可能出现的 token"——**最像人话的延续，不等于事实正确的延续**。再加上训练数据有截止日期、长尾事实在参数里存得模糊，模型就会用流畅自信的语气说出虚构内容。这不是"说谎"，而是概率生成机制的天然副作用。

## 工程启示

事实型问题：调低 temperature，必要时配合检索（RAG）给模型"现行资料"；创意型任务：适当调高 temperature 或放宽 top-p。幻觉无法靠采样参数根治，只能缓解和兜底——这也是应用篇里 RAG 存在的意义。

## 可选代码片段

### temperature 与 top-p 的直观对比

```python
import math

# 假设模型已生成「这功能真」，下一个字的候选打分：
logits = {"魔": 2.0, "棒": 1.5, "绝": 0.8, "饼": 0.1}

def dist(logits, temperature=1.0, top_p=1.0):
    scaled = {w: v / temperature for w, v in logits.items()}
    m = max(scaled.values())
    exps = {w: math.exp(v - m) for w, v in scaled.items()}
    total = sum(exps.values())
    probs = {w: e / total for w, e in exps.items()}
    kept, acc = {}, 0.0
    for w in sorted(probs, key=probs.get, reverse=True):
        kept[w] = probs[w]
        acc += probs[w]
        if acc >= top_p:
            break
    renorm = sum(kept.values())
    return {w: round(p / renorm, 3) for w, p in kept.items()}

print("temperature=1.5 :", dist(logits, 1.5))
print("temperature=0.3 :", dist(logits, 0.3))
print("top_p=0.6       :", dist(logits, 1.0, 0.6))
```

## 随堂轻习题

### Q1 · single · ex-sample-1
题干：把 temperature 从 1.0 调低到 0.2，模型的输出会？
选项：
- A. 更发散，创意更多
- B. 概率分布更尖锐，输出更稳定保守
- C. 词汇量变大
- D. 生成速度变快
答案：B
解析：temperature 调低会放大分数差距，让高分候选几乎通吃——输出更确定，适合代码与事实问答；A 是调高的效果，C、D 与它无关。
知识点：temperature

### Q2 · multi · ex-sample-2
题干：关于 top-p（核采样），下面说法正确的是？（多选）
选项：
- A. 按概率从高到低保留候选，累加到 p 就停
- B. 保留多少个候选是动态的，取决于当前分布
- C. 剩下的候选会重新归一化概率
- D. 只要设了 top-p，模型就不再出现幻觉
答案：A,B,C
解析：A、B、C 是 top-p 的机制本体；D 把"缓解"说成了"根治"——幻觉源于概率生成机制本身，采样参数只能缓解。
知识点：top-p

### Q3 · judge · ex-sample-3
题干：模型一本正经地编造了不存在的产品功能，说明它有意欺骗用户。
选项：正确 / 错误
答案：错误
解析：模型优化的是"下一个最像人话的 token"，不是"事实为真"——流畅而虚构是概率生成机制的副作用，不是意图。工程上靠 RAG、引用来源与人工校验来兜底。
知识点：幻觉成因
