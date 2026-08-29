---
sectionId: "sec-alignment"
title: "对齐：从 RLHF 到 DPO"
moduleCode: "core_principle"
chapterCode: "ch-core-alignment"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 8
version: "2026-08"
sources:
  - "InstructGPT (Ouyang et al. 2022)"
  - "DPO (Rafailov et al. 2023)"
  - "mlabonne/llm-course"
codeVerified: true
codeLevel: "A"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 11
---

## 一句话直觉

预训练出来的基座模型是个"博览群书的续写机器"——你问它问题，它可能接着写出更多问题。**对齐（alignment）**就是教它把续写能力用在正道上：听懂指令、回答有帮助、拒绝有害请求。

## 三阶段：SFT → 奖励模型 → 强化学习

业界经典的 RLHF（人类反馈强化学习）流程分三步：

1. **SFT（监督微调）**：用人工撰写的高质量"问答对"教模型基本的对话格式与听话能力
2. **训练奖励模型（RM）**：让人类对同一问题的多个回答排序，据此训练一个模拟人类偏好的"打分器"
3. **强化学习（PPO）**：模型生成回答、奖励模型打分，以"得分更高"为方向持续调整模型

## DPO：把三步砍成两步

RLHF 效果好，但要额外养一个奖励模型，还要跑出了名不稳定的强化学习。2023 年提出的 **DPO（直接偏好优化）**给出一条捷径：跳过显式的奖励模型，直接用人类标注的"偏好对（哪个回答更好）"优化模型本身——数学上可以证明，这等价于在优化同一个目标。训练更简单、更稳定，因此成为开源社区的主流选择。

两个阶段的背后是同一块基石：**Bradley–Terry 偏好概率**——给两个回答各打一个分，"A 优于 B"的概率就是两分之差的 sigmoid。奖励模型学的就是这个分，DPO 优化的也是这个差。

## 一个常被误解的点

对齐调整的是行为的"方向"，不是替换基座能力——SFT 与偏好优化都建立在预训练出的语言能力之上。基座越强，对齐后越强；对齐缺失或粗糙，再强的基座也会"有才不会用"。这也是为什么本课程把预训练放在对齐之前讲。

## 眼见为实

下面的片段用 Bradley–Terry 公式直接计算"回答 A 优于回答 B"的概率：奖励模型的训练就是在拟合人类给出的这类偏好，DPO 的损失函数也建立在同一个式子上。

## 可选代码片段

### Bradley–Terry 偏好概率

```python
import math

def preference_prob(score_a, score_b):
    # Bradley-Terry 模型：P(A 优于 B) = sigmoid(score_A - score_B)
    return 1 / (1 + math.exp(-(score_a - score_b)))

examples = [
    ("有理有据的讲解", 2.0, "敷衍的不知道", -1.0),
    ("编造的答案", -0.5, "坦诚说明不会", 0.5),
]
for name_a, sa, name_b, sb in examples:
    p = preference_prob(sa, sb)
    print(f"「{name_a}」优于「{name_b}」的概率 = {p:.2f}")
```

## 随堂轻习题

### Q1 · single · ex-align-1
题干：经典 RLHF 流程的三个阶段，正确的顺序是？
选项：
- A. 奖励模型 → SFT → 强化学习
- B. SFT → 训练奖励模型 → 强化学习优化
- C. 强化学习 → SFT → 奖励模型
- D. 偏好标注 → 预训练 → SFT
答案：B
解析：先用人写问答对教格式（SFT），再用人类偏好训练打分器（RM），最后以打分为信号做强化学习（PPO）——顺序不能乱，后面的阶段都建立在前面的产物上。
知识点：RLHF 流程

### Q2 · single · ex-align-2
题干：DPO 相比经典 RLHF，最大的变化是？
选项：
- A. 不再需要人类标注偏好数据
- B. 不再需要预训练基座模型
- C. 跳过显式的奖励模型，用偏好对直接优化模型
- D. 完全放弃了 Bradley-Terry 概率模型
答案：C
解析：DPO 的核心贡献正是"去掉显式奖励模型"这一步——偏好数据照样要人工标，基座照样要预训练，且其损失函数与 RLHF 的目标在数学上等价，同一块 Bradley-Terry 基石并没有被放弃。
知识点：DPO

### Q3 · judge · ex-align-3
题干：完成对齐训练后，模型的下一个 token 预测能力就被对话能力完全替换了。
选项：正确 / 错误
答案：错误
解析：对齐是在预训练能力之上调整行为方向，不是推倒重来——SFT 和偏好优化都依赖基座已有的语言能力，基座越强，对齐后越强。
知识点：对齐与基座的关系
