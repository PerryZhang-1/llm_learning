---
sectionId: "sec-agent"
title: "Agent 机制：让模型学会用工具"
moduleCode: "app"
chapterCode: "ch-app-agent"
difficulty: "core"
sectionType: "normal"
estimatedMinutes: 8
version: "2026-08"
sources:
  - "ReAct (Yao et al. 2022)"
  - "OpenAI function calling guide"
  - "Anthropic MCP docs"
codeVerified: true
codeLevel: "A"
reviewedBy: "pending"
lastReviewedAt: null
order: 12
---

## 一句话直觉

LLM 本身只会输出文字：它查不了数据库、算不准长算式、也不知道今天天气。**Agent（智能体）**的思路是——把一组"工具"交给模型，让它把"该调哪个工具、传什么参数"也当成文字说出来，由外部程序代为执行，再把结果喂回去让它接着想。**想一步、做一步、看一眼结果再想**，这个循环就是 ReAct 模式。

## 一次工具调用的解剖

一个工具在工程上就是三样东西：**名字、参数说明、函数本体**。主流模型厂商的"函数调用（function calling）"能力，已经把"输出合法的工具调用 JSON"训练成标配——模型负责决定"调什么、传什么"，真正的执行永远发生在你的程序里，执行结果作为新的上下文喂回模型。

## 多步与边界

真实任务常常要串多个工具（先查天气、再做计算、最后总结）。但循环要有**上限**（防止无限打转）、工具失败要有**兜底提示**、每一步都在**花 token**——Agent 不是越自主越好，能一步到位的就不要绕圈。

## 生态一瞥

工具接入正在标准化：2024 年底 Anthropic 开源的 **MCP（模型上下文协议）**，目标是让同一个工具服务器能被任何支持协议的模型客户端调用——写一次，处处可用。

## 眼见为实

下面的代码用固定脚本模拟 ReAct 骨架（真实系统里"思考"由 LLM 生成）：两个工具、一条多步调用链——先查两地天气，再用计算工具算温差。注意"观察"这一拍不是模型生成的，而是运行时把工具的真实返回值塞回上下文。

## 可选代码片段

### ReAct 循环骨架（思考 → 行动 → 观察）

```python
def add(a, b):
    return a + b

def get_weather(city):
    return {"北京": {"天气": "晴", "气温": 24}, "上海": {"天气": "多云", "气温": 19}}[city]

tools = {"add": add, "get_weather": get_weather}
log = []

def run_agent(steps):
    last_result = None
    for kind, payload in steps:
        if kind == "thought":
            log.append(f"思考: {payload}")
        elif kind == "action":
            name, args = payload
            last_result = tools[name](**args)
            log.append(f"行动: 调用 {name}({args})")
        elif kind == "observation":
            log.append(f"观察: 工具返回 → {last_result}")
        elif kind == "final":
            log.append(f"回答: {payload}")

run_agent([
    ("thought", "用户问北京比上海气温高几度，我需要两个城市的天气"),
    ("action", ("get_weather", {"city": "北京"})),
    ("observation", None),
    ("action", ("get_weather", {"city": "上海"})),
    ("observation", None),
    ("thought", "温差是 24 - 19，用计算工具算一下"),
    ("action", ("add", {"a": 24, "b": -19})),
    ("observation", None),
    ("final", "北京（24°C）比上海（19°C）高 5 度。"),
])
print("\n".join(log))
```

## 随堂轻习题

### Q1 · single · ex-agent-1
题干：Agent 里"工具调用"的本质是？
选项：
- A. 模型直接联网执行各种操作
- B. 模型输出结构化的调用意图，由外部程序执行后把结果喂回上下文
- C. 把工具的代码塞进提示词让模型运行
- D. 每接入一个工具都要重新训练模型
答案：B
解析：模型只负责"说"要调什么工具和参数，执行永远发生在你的程序里，执行结果再作为新的上下文喂回去——安全边界和可控性都来自这个分工。
知识点：工具调用

### Q2 · judge · ex-agent-2
题干：Agent 的工具调用循环应该不设上限，让模型自由发挥。
选项：正确 / 错误
答案：错误
解析：循环要有上限（防无限打转）、失败要有兜底、每步都在花 token——自主性要和可控性、成本一起设计。
知识点：Agent 边界

### Q3 · multi · ex-agent-3
题干：关于 ReAct 循环，下面说法正确的是？（多选）
选项：
- A. 思考、行动、观察三拍交替进行
- B. 观察结果会进入上下文，影响后续的思考
- C. 工具结果与对话历史一起构成模型的上下文
- D. "观察"这一拍的内容由模型自己生成
答案：A,B,C
解析：D 说反了——观察是运行时把工具的真实返回值塞回上下文，如果让模型自己编工具结果，工具就失去意义了。
知识点：ReAct 循环
