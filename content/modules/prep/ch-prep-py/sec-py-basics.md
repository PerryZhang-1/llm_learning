---
sectionId: "sec-py-basics"
title: "Python 数据结构速览"
moduleCode: "prep"
chapterCode: "ch-prep-py"
difficulty: "prep"
sectionType: "normal"
estimatedMinutes: 6
version: "2026-08"
sources:
  - "Python 官方教程"
codeVerified: true
codeLevel: "none"
reviewedBy: "Perry"
lastReviewedAt: "2026-08-29"
order: 1
---

## 为什么先看这个

大模型开发的胶水语言就是 Python。本节只挑**后面课程一定会用到**的部分讲。

## 列表与字典

- **列表（list）**：有序、可变的元素序列，类比"一排储物柜"
- **字典（dict）**：键值对，类比"通讯录"——按名字找人，而不是按位置

## 列表推导式

一行代码生成新列表，是 Python 处理数据的常用写法：

```python
squares = [x * x for x in range(5)]  # [0, 1, 4, 9, 16]
```

后面处理 token 序列、批量构造 prompt 时会大量用到它。

## 随堂轻习题

### Q1 · single · ex-py-1
题干：Python 字典（dict）最接近下面哪个类比？
选项：
- A. 一排按顺序编号的储物柜
- B. 按名字查号码的通讯录
- C. 一条流水线
- D. 一个随机抽签箱
答案：B
解析：字典按键（key）取值，就像通讯录按名字查号码；按顺序编号的储物柜更接近列表（list）。
知识点：数据结构
