import { PrismaClient } from "@prisma/client";

/**
 * 种子数据：知识树样例（开发文档 §4 内容体系的 MVP 样例）
 * 使用固定 ID，保证链接与演示稳定；重复执行幂等（先清后插）
 *
 * 习题答案约定（与服务端判分一致）：
 * - single：正确选项下标（数字）
 * - multi：正确选项下标数组
 * - judge：布尔（选项固定为 ["正确","错误"]）
 */

const prisma = new PrismaClient();

const VERSION = "2026-08";

interface SeedExercise {
  id: string;
  question: string;
  type: string;
  options: string[];
  answer: unknown;
  explanation: string;
  knowledgePoint: string;
}

interface SeedSection {
  id: string;
  chapterCode: string;
  title: string;
  sectionType?: string;
  estimatedMinutes: number;
  bodyMarkdown: string;
  codeSnippets?: { title: string; code: string }[];
  sourceRefs: string[];
  exercises: SeedExercise[];
}

const modules = [
  {
    id: "mod-prep",
    code: "prep",
    name: "预备包",
    description: "Python 与机器学习基础，按需开启，不影响主线",
    isOptional: true,
    order: 1,
  },
  {
    id: "mod-core",
    code: "core_principle",
    name: "核心原理",
    description: "Transformer 与大模型的工作方式，一次讲透",
    isOptional: false,
    order: 2,
  },
  {
    id: "mod-app",
    code: "app",
    name: "应用开发",
    description: "Prompt、RAG、Agent：把大模型用起来",
    isOptional: false,
    order: 3,
  },
  {
    id: "mod-eng",
    code: "engineering",
    name: "高阶包 · 工程化",
    description: "微调、量化、部署，进阶选修",
    isOptional: true,
    order: 4,
  },
];

const chapters = [
  { id: "ch-prep-py", moduleId: "mod-prep", name: "Python 基础回顾", order: 1 },
  { id: "ch-core-transformer", moduleId: "mod-core", name: "Transformer 第一步", order: 1 },
  { id: "ch-core-attention", moduleId: "mod-core", name: "注意力机制", order: 2 },
  { id: "ch-app-prompt", moduleId: "mod-app", name: "Prompt 工程", order: 1 },
  { id: "ch-app-rag", moduleId: "mod-app", name: "RAG 检索增强", order: 2 },
  { id: "ch-eng-deploy", moduleId: "mod-eng", name: "模型部署入门", order: 1 },
];

const sections: SeedSection[] = [
  {
    id: "sec-py-basics",
    chapterCode: "ch-prep-py",
    title: "Python 数据结构速览",
    estimatedMinutes: 6,
    sourceRefs: ["Python 官方教程"],
    bodyMarkdown: `## 为什么先看这个

大模型开发的胶水语言就是 Python。本节只挑**后面课程一定会用到**的部分讲。

## 列表与字典

- **列表（list）**：有序、可变的元素序列，类比"一排储物柜"
- **字典（dict）**：键值对，类比"通讯录"——按名字找人，而不是按位置

## 列表推导式

一行代码生成新列表，是 Python 处理数据的常用写法：

\`\`\`python
squares = [x * x for x in range(5)]  # [0, 1, 4, 9, 16]
\`\`\`

后面处理 token 序列、批量构造 prompt 时会大量用到它。`,
    exercises: [
      {
        id: "ex-py-1",
        question: "Python 字典（dict）最接近下面哪个类比？",
        type: "single",
        options: ["一排按顺序编号的储物柜", "按名字查号码的通讯录", "一条流水线", "一个随机抽签箱"],
        answer: 1,
        explanation: "字典按键（key）取值，就像通讯录按名字查号码；按顺序编号的储物柜更接近列表（list）。",
        knowledgePoint: "数据结构",
      },
    ],
  },
  {
    id: "sec-transformer-intro",
    chapterCode: "ch-core-transformer",
    title: "大模型是怎么\"读\"文字的",
    estimatedMinutes: 8,
    sourceRefs: ["LLMs-from-scratch (rasbt)", "The Illustrated Transformer"],
    bodyMarkdown: `## 从文字到数字

模型不认识汉字，只认识数字。第一步是把文本切成 **token**（词元），再映射成向量。

比如"我爱学习"可能被切成 \`我\`、\`爱\`、\`学习\` 三个 token，每个 token 对应词表里的一个编号。

## 上下文是核心

同一个词在不同句子里意思不同。Transformer 的天才之处在于：让每个 token 在计算自己的表示时，**同时参考它周围的所有 token**。

这个"参考周围"的机制就是下一节的注意力（Attention）。

## 一句话总结

> 大模型 = 把文本变成向量序列，再用注意力机制反复加工这些向量的机器。`,
    exercises: [
      {
        id: "ex-tf-1",
        question: "关于 token，下面说法正确的是？（多选）",
        type: "multi",
        options: [
          "token 是文本被切分后的基本单位",
          "一个 token 一定等于一个汉字",
          "每个 token 会被映射成词表中的一个编号",
          "token 序列会被转成向量再进入模型",
        ],
        answer: [0, 2, 3],
        explanation: "token 的粒度由分词器决定，可能是一个字、一个词，甚至半个词，所以\"一定等于一个汉字\"不对。其余三项是 token 化的标准流程。",
        knowledgePoint: "token 化",
      },
      {
        id: "ex-tf-2",
        question: "Transformer 处理语言歧义的关键是：每个 token 会参考周围的 token 来计算自己的表示。",
        type: "judge",
        options: ["正确", "错误"],
        answer: true,
        explanation: "正确。注意力机制让每个位置结合上下文信息，这正是\"同一个词在不同句子含义不同\"能被处理的原因。",
        knowledgePoint: "上下文建模",
      },
    ],
  },
  {
    id: "sec-attention",
    chapterCode: "ch-core-attention",
    title: "注意力机制：查询、键、值",
    estimatedMinutes: 9,
    sourceRefs: ["Attention Is All You Need", "mlabonne/llm-course"],
    bodyMarkdown: `## Q、K、V 三兄弟

注意力机制用三个角色工作：

- **Query（查询）**：我在找什么信息
- **Key（键）**：我这里有什么信息的"标签"
- **Value（值）**：我实际能提供的信息

类比图书馆找书：你带着需求（Query）对照每本书的索引标签（Key），匹配度决定你读哪本书的正文（Value）。

## 计算流程

1. Query 与所有 Key 做点积 → 得到"匹配分数"
2. 分数经过 softmax 归一化 → 变成注意力权重
3. 用权重对所有 Value 加权求和 → 输出

分数越高的位置，对输出的影响越大。`,
    exercises: [
      {
        id: "ex-attn-1",
        question: "在注意力机制中，决定\"从哪些位置取多少信息\"的是？",
        type: "single",
        options: ["Value 本身", "Query 与 Key 的点积分数（经 softmax）", "token 的原始编号", "随机数"],
        answer: 1,
        explanation: "Query 与 Key 的点积衡量匹配程度，经过 softmax 变成权重，再用于加权 Value。这就是注意力权重的由来。",
        knowledgePoint: "注意力权重",
      },
    ],
  },
  {
    id: "sec-attention-code",
    chapterCode: "ch-core-attention",
    title: "动手：用 10 行代码感受注意力",
    sectionType: "code_practice",
    estimatedMinutes: 10,
    sourceRefs: ["LLMs-from-scratch (rasbt)"],
    bodyMarkdown: `## 代码先行

先展开下面的代码块读一遍，体会"点积 → softmax → 加权求和"这三步。

## 小结

这段代码就是注意力机制的最小骨架。真实的 Transformer 还加了缩放因子和掩码，但核心流程完全一样。`,
    codeSnippets: [
      {
        title: "最小注意力（伪 numpy 风格）",
        code: `# Q/K/V 都是向量序列（形状: 序列长度 x 维度）
scores = Q @ K.T              # 第一步：点积得到匹配分数
scores = scores / (d ** 0.5)  # 缩放：防止分数过大（真实实现有此步）
weights = softmax(scores)     # 第二步：归一化成权重
output = weights @ V          # 第三步：加权求和`,
      },
    ],
    exercises: [
      {
        id: "ex-attn-code-1",
        question: "上面代码中，softmax 的作用是？",
        type: "single",
        options: ["把分数变成 0~1 之间且和为 1 的权重", "压缩向量维度", "随机打乱顺序", "去掉噪声"],
        answer: 0,
        explanation: "softmax 把任意实数分数归一化成概率分布（和为 1），这样才能当作\"注意力权重\"去加权 Value。",
        knowledgePoint: "softmax",
      },
    ],
  },
  {
    id: "sec-prompt",
    chapterCode: "ch-app-prompt",
    title: "写好 Prompt 的三原则",
    estimatedMinutes: 7,
    sourceRefs: ["microsoft/generative-ai-for-beginners"],
    bodyMarkdown: `## 原则一：明确角色与任务

\`\`\`
你是一位耐心的数学老师，请用初中生能懂的语言解释勾股定理。
\`\`\`

比"解释一下勾股定理"稳定得多。

## 原则二：给出格式要求

要 JSON 就要 JSON 的字段说明；要列表就指明条目数量。模型的输出格式是"要出来的"，不是"猜出来的"。

## 原则三：提供示例（few-shot）

给 1~2 个输入输出示例，模型模仿示例的能力远强于理解抽象描述的能力。

## 常见误区

- 一次性塞入太多要求 → 拆成多轮
- 期望模型记住上一轮所有细节 → 关键信息重复给`,
    exercises: [
      {
        id: "ex-prompt-1",
        question: "想稳定获得 JSON 格式的输出，最有效的做法是？",
        type: "single",
        options: ["在提示里明确写出字段与格式要求", "多问几遍碰运气", "把温度调到最高", "先问模型会不会输出 JSON"],
        answer: 0,
        explanation: "输出格式需要在提示中显式约定（字段名、结构、示例），模型不会\"自动猜\"出你想要的格式。",
        knowledgePoint: "格式控制",
      },
    ],
  },
  {
    id: "sec-rag",
    chapterCode: "ch-app-rag",
    title: "RAG：让模型先查资料再回答",
    estimatedMinutes: 8,
    sourceRefs: ["datawhalechina/llm-universe"],
    bodyMarkdown: `## 为什么需要 RAG

大模型的知识有截止日期，也不知道你的私有资料。RAG（检索增强生成）的思路很简单：

> 先检索相关资料，把资料塞进提示词，再让模型基于资料回答。

## 三步流程

1. **索引**：文档切块 → 转成向量 → 存入向量数据库
2. **检索**：用户提问转向量 → 找出最相似的若干文档块
3. **生成**：把检索结果作为上下文交给模型生成回答

## 关键取舍

- 切块太大：检索不精准；切块太小：丢失上下文
- 检索质量决定回答上限——"垃圾进，垃圾出"`,
    exercises: [
      {
        id: "ex-rag-1",
        question: "RAG 中，决定回答质量上限的关键环节是？",
        type: "single",
        options: ["模型的参数规模", "检索到的资料质量", "回答的排版", "用户的打字速度"],
        answer: 1,
        explanation: "模型是基于检索到的资料作答的，检索不准则回答必然跑偏，所以说\"检索质量决定回答上限\"。",
        knowledgePoint: "检索质量",
      },
    ],
  },
  {
    id: "sec-deploy",
    chapterCode: "ch-eng-deploy",
    title: "部署一个开源模型的完整链路",
    estimatedMinutes: 9,
    sourceRefs: ["datawhalechina/self-llm"],
    bodyMarkdown: `## 部署链路总览

1. **选模型**：看参数量、上下文长度、开源协议
2. **准备算力**：显存估算（参数量 × 2 字节 ≈ FP16 所需显存下限）
3. **量化（可选）**：用 4bit/8bit 降低显存占用，牺牲少量精度
4. **推理框架**：vLLM、llama.cpp 等加速推理
5. **服务化**：包成 API 对外提供服务

## 显存直觉

7B 模型 FP16 加载约需 14GB 显存，再加推理开销；4bit 量化后可压到 6GB 左右——这是"显存不够就量化"的由来。`,
    exercises: [
      {
        id: "ex-deploy-1",
        question: "7B 参数模型以 FP16 精度加载，显存占用大约为？",
        type: "single",
        options: ["约 3.5GB", "约 14GB", "约 70GB", "约 700MB"],
        answer: 1,
        explanation: "FP16 每个参数占 2 字节，7B × 2B ≈ 14GB。实际推理还需要额外开销，所以选卡要留余量。",
        knowledgePoint: "显存估算",
      },
    ],
  },
];

async function main() {
  console.log("清理旧数据…");
  // 按外键依赖顺序清理
  await prisma.knowledgeChunk.deleteMany();
  await prisma.llmExercise.deleteMany();
  await prisma.llmSection.deleteMany();
  await prisma.llmChapter.deleteMany();
  await prisma.llmModule.deleteMany();

  console.log("写入模块与章节…");
  for (const m of modules) {
    await prisma.llmModule.create({ data: m });
  }
  for (const c of chapters) {
    await prisma.llmChapter.create({ data: c });
  }

  console.log("写入小节、习题与知识块…");
  for (const s of sections) {
    await prisma.llmSection.create({
      data: {
        id: s.id,
        chapterId: s.chapterCode,
        title: s.title,
        sectionType: s.sectionType ?? "normal",
        estimatedMinutes: s.estimatedMinutes,
        bodyMarkdown: s.bodyMarkdown,
        codeSnippets: s.codeSnippets ? JSON.stringify(s.codeSnippets) : null,
        version: VERSION,
        sourceRefs: JSON.stringify(s.sourceRefs),
        codeVerified: true, // 样例内容已过静态检查
        order: sections.indexOf(s) + 1,
      },
    });

    for (let i = 0; i < s.exercises.length; i++) {
      const ex = s.exercises[i];
      await prisma.llmExercise.create({
        data: {
          id: ex.id,
          sectionId: s.id,
          question: ex.question,
          type: ex.type,
          options: JSON.stringify(ex.options),
          answer: JSON.stringify(ex.answer),
          explanation: ex.explanation,
          knowledgePoint: ex.knowledgePoint,
          order: i + 1,
        },
      });
    }

    // 知识块：按二级标题切分正文（开发环境关键词检索；生产切块后嵌入）
    const blocks = s.bodyMarkdown
      .split(/\n## /)
      .map((b) => b.trim())
      .filter(Boolean);
    for (const block of blocks) {
      await prisma.knowledgeChunk.create({
        data: {
          sectionId: s.id,
          body: `${s.title}\n${block}`,
          version: VERSION,
          embeddingModel: "none",
        },
      });
    }
  }

  console.log(`种子数据完成：${modules.length} 模块 / ${chapters.length} 章节 / ${sections.length} 小节`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
