---
sectionId: "sec-deploy"
title: "部署一个开源模型的完整链路"
moduleCode: "engineering"
chapterCode: "ch-eng-deploy"
difficulty: "advanced"
sectionType: "normal"
estimatedMinutes: 9
version: "2026-08"
sources:
  - "datawhalechina/self-llm"
codeVerified: true
codeLevel: "none"
reviewedBy: "pending"
lastReviewedAt: null
order: 7
---

## 部署链路总览

1. **选模型**：看参数量、上下文长度、开源协议
2. **准备算力**：显存估算（参数量 × 2 字节 ≈ FP16 所需显存下限）
3. **量化（可选）**：用 4bit/8bit 降低显存占用，牺牲少量精度
4. **推理框架**：vLLM、llama.cpp 等加速推理
5. **服务化**：包成 API 对外提供服务

## 显存直觉

7B 模型 FP16 加载约需 14GB 显存，再加推理开销；4bit 量化后可压到 6GB 左右——这是"显存不够就量化"的由来。

## 随堂轻习题

### Q1 · single · ex-deploy-1
题干：7B 参数模型以 FP16 精度加载，显存占用大约为？
选项：
- A. 约 3.5GB
- B. 约 14GB
- C. 约 70GB
- D. 约 700MB
答案：B
解析：FP16 每个参数占 2 字节，7B × 2B ≈ 14GB。实际推理还需要额外开销，所以选卡要留余量。
知识点：显存估算
