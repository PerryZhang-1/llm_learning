# 审阅记录：第一批 AI 初稿人工终审（规则 7 留档）

| 项 | 值 |
|---|---|
| 批次 | 第一批：模块 2 核心原理补齐（3 节 + catalog 新增 3 章节） |
| 审校人 | Perry |
| 终审日期 | 2026-08-29 |
| 结论 | **通过**——3/3 节签署 reviewedBy: "Perry" |

## 逐节核对结论

| 小节 | 核心主张核对 | 习题答案 | A 级代码 | 结论 |
|---|---|---|---|---|
| sec-pretrain | 自监督接龙/交叉熵/三要素匹配/基座只续写 | B / 错误 / ABC | bigram 迷你模型，CI 实跑通过 | 通过 |
| sec-sampling | temperature 尖锐度/top-k vs top-p/幻觉=优化「像」非「真」 | B / ABC / 错误 | temperature+top-p 分布对比，CI 实跑通过 | 通过 |
| sec-alignment | RLHF 三阶段/DPO 等价性/Bradley-Terry 基石/对齐不替换基座 | B / C / 错误 | 偏好概率计算，CI 实跑通过 | 通过 |

## 门禁事件记录

- sec-pretrain 初稿命中规则 4（「历史上最」触发「史上最」模式）被 sync 拦截，已改为平实表述后放行——门禁对 AI 初稿有效性的直接证据

## 通用项

- 3 节均为 A 级标准库代码，GitHub CI Python 3.12 实跑通过
- 来源含 InstructGPT (2022)、DPO (2023) 原论文与权威课程
- 章节间衔接：注意力 → 预训练 → 采样 → 对齐，与知识树顺序一致
