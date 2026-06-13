# LLM基础理论

## 一、Transformer架构

### Q1: 请画出Transformer架构图并详细讲解

```
┌──────────────────────────────────────────────────────────────┐
│                         Transformer                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│     ┌──────────────┐          ┌──────────────┐              │
│     │   输入句子   │          │   输出句子   │              │
│     └──────┬───────┘          └──────┬───────┘              │
│            │                          │                      │
│            ▼                          ▼                      │
│     ┌──────────────┐          ┌──────────────┐              │
│     │  Input      │          │  Output     │              │
│     │  Embedding  │          │  Embedding  │              │
│     └──────┬───────┘          └──────┬───────┘              │
│            │ + Positional             │ + Positional         │
│            ▼   Encoding               ▼   Encoding           │
│     ┌──────────────┐          ┌──────────────┐              │
│     │ N × Encoder  │◄────────►│ N × Decoder  │              │
│     │    Layer     │  Cross   │    Layer     │              │
│     └──────┬───────┘ Atten   └──────┬───────┘              │
│            │                          │                      │
│            ▼                          ▼                      │
│     ┌──────────────┐          ┌──────────────┐              │
│     │    Linear    │          │    Linear    │              │
│     │    + Softmax │          │    + Softmax │              │
│     └──────┬───────┘          └──────┬───────┘              │
│            │                          │                      │
│            ▼                          ▼                      │
│     ┌──────────────┐          ┌──────────────┐              │
│     │  输出概率    │          │  预测下一词  │              │
│     └──────────────┘          └──────────────┘              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Encoder 层内部结构：**
1. Multi-Head Self-Attention（多头自注意力）
2. Add & Norm（残差连接 + 层归一化）
3. Feed-Forward（两层全连接，中间有激活函数）
4. Add & Norm

**Decoder 层内部结构：**
1. Masked Multi-Head Self-Attention（掩码多头自注意力）
2. Add & Norm
3. Cross-Attention（注意力到 Encoder 输出）
4. Add & Norm
5. Feed-Forward
6. Add & Norm

### Q2: 为什么需要位置编码（Positional Encoding）？

> Attention机制是位置无关的，即打乱词序后Attention的结果一样，无法建模词序信息。
> 位置编码为每个位置添加一个独特的向量，使模型能够感知词的位置关系。

**Sinusoidal 位置编码公式：**
```
PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

**优点：**
- 可以外推到更长的序列（训练时最长512，推理时可处理1000）
- 无需训练，节省参数

**现代模型的位置编码方案：**

| 方案 | 使用模型 | 特点 |
|------|---------|------|
| 绝对位置编码 | GPT-1/2 | 简单直接，不可外推 |
| 正弦位置编码 | Transformer原论文 | 可外推，非学习 |
| Rotary Positional Embedding (RoPE) | LLaMA, GPT-NeoX | 旋转位置编码，相对位置 |
| ALiBi | MPT, BLOOM | 无位置编码，通过attention衰减实现 |

### Q3: Multi-Head Attention为什么有效？

```
Multi-Head(Q, K, V) = Concat(head_1, head_2, ..., head_h) · W^O

其中 head_i = Attention(Q·W_i^Q, K·W_i^K, V·W_i^V)
```

**直觉理解：**
- 多头让模型在不同表示子空间关注不同信息
- 比如head1关注语法关系、head2关注语义相关性、head3关注实体指代
- 每个head学习不同类型的依赖关系

**类比：**类似人看一张图片，有人关注颜色，有人关注形状，有人关注纹理。多头注意力让模型同时从多个角度理解信息。

### Q4: Encoder-Decoder vs 仅Decoder模型

| 特性 | Encoder-Decoder（T5/BART） | 仅Decoder（GPT系列） |
|------|-----------------------------|----------------------|
| 架构 | Encoder + Decoder，双向+单向 | 单向Decoder-only |
| 注意力 | Encoder双向，Decoder因果 | 全部因果（单向） |
| 训练任务 | 序列到序列（翻译、摘要） | 自回归语言建模 |
| 生成能力 | 需要输入-输出对 | 任意文本生成 |
| 推理方式 | Encoder一次性编码，Decoder自回归 | 全流程自回归 |

**为什么GPT选择Decoder-only？**
- 更大的模型容量和表达能力
- 训练任务简单（next token prediction）
- 更适合长文本生成
- 规模效应明显（scaling law）

---

## 二、Attention机制详解

### Q5: Self-Attention的数学表达与计算过程

```
Attention(Q, K, V) = softmax(Q · K^T / √d_k) · V
```

**计算步骤：**

```
Step 1: 计算 Query × Key^T（相似度矩阵）
    [seq_len, d_model] × [d_model, seq_len] → [seq_len, seq_len]
    
    即：每个词与所有词计算相似度
    
    
Step 2: 除以 √d_k（缩放因子，防止梯度消失）
    d_k较大时，Q·K^T的乘积会很大，softmax后梯度变小
    
    
Step 3: softmax归一化（得到每个位置的注意力权重）
    [seq_len, seq_len] → 每行表示当前词对所有词的权重
    
    
Step 4: 与 Value 相乘（加权求和）
    [seq_len, seq_len] × [seq_len, d_v] → [seq_len, d_v]
    
    每个词的表示 = Σ（权重 × 对应词的Value向量）
```

### Q6: Self-Attention vs 传统RNN/CNN的优势

| 维度 | Self-Attention | RNN | CNN |
|------|---------------|-----|-----|
| 长距离依赖 | O(1)路径长度，直接连接 | O(n)路径，序列越长越弱 | 感受野有限，需多层 |
| 并行计算 | 完全并行，GPU友好 | 顺序计算，无法并行 | 可并行 |
| 计算复杂度 | O(n²·d)，n大时较慢 | O(n·d²) | O(n·d·k²) |
| 可解释性 | 有注意力权重可看 | 隐藏状态难以解释 | 特征图可分析 |

### Q7: 为什么除以√d_k（缩放点积注意力）？

**数学直觉：**
- Q和K的每个元素是均值为0，方差为1的随机变量
- 点积 Q·K^T 的方差 = d_k × Var(q) × Var(k) = d_k
- 当d_k很大时，点积结果方差很大，部分值非常大
- softmax后大值会主导，梯度变小（梯度消失）
- 除以√d_k，将方差归一化到1，softmax的梯度更稳定

### Q8: Cross-Attention是如何工作的？

> Cross-Attention在Decoder中使用，Query来自Decoder，Key/Value来自Encoder输出，让生成过程关注输入的不同部分。

```
示例：翻译任务 "我爱AI" → "I love AI"

Encoder输出：[I_embedding, love_embedding, AI_embedding]

Decoder生成第一个词"I"时：
  Query = "I"的表示
  Key,Value = Encoder的全部输出
  → 计算Query与每个输入词的相似度 → 关注"我"

Decoder生成"love"时：
  Query = "I love"的表示
  Key,Value = Encoder的全部输出
  → 关注"爱"
```

### Q9: 因果注意力（Causal Attention / Masked Attention）

> 在生成式模型中，当前位置只能看到之前的token，不能看到未来的token。通过添加掩码（mask）实现。

**掩码矩阵示例（seq_len=4）：**
```
    token1  token2  token3  token4
t1    ✓      ✗      ✗      ✗     ← t1只能看自己
t2    ✓      ✓      ✗      ✗     ← t2能看t1,t2
t3    ✓      ✓      ✓      ✗     ← t3能看前3个
t4    ✓      ✓      ✓      ✓     ← t4能看全部

其中：
  ✓ = 正常计算
  ✗ = 设置为 -infinity（softmax后权重为0）
```

---

## 三、训练与推理原理

### Q10: LLM是如何训练的？

```
阶段一：预训练（Pre-training）
┌──────────────────────────────────────────┐
│ 数据：大规模无标注文本（万亿级token）     │
│ 任务：自回归语言建模（预测下一个词）       │
│ 目标：学习通用语言理解与生成能力           │
│ 损失：交叉熵（仅在预测位置计算）           │
└──────────────────────────────────────────┘

阶段二：指令微调（SFT - Supervised Fine-Tuning）
┌──────────────────────────────────────────┐
│ 数据：高质量指令-回答对（百万级）          │
│ 任务：学习遵循指令生成合适回答              │
│ 目标：提升任务遵循能力，输出更符合人类格式  │
└──────────────────────────────────────────┘

阶段三：RLHF（基于人类反馈的强化学习）
┌──────────────────────────────────────────┐
│ 步骤1：收集人类偏好数据（排序标注）         │
│ 步骤2：训练Reward Model（奖励模型）         │
│ 步骤3：用PPO强化学习微调LLM                │
│ 目标：提升有用性、安全性，与人类偏好对齐     │
└──────────────────────────────────────────┘
```

### Q11: 推理时的解码策略有哪些？

| 策略 | 原理 | 特点 |
|------|------|------|
| Greedy Search | 每步选概率最大的词 | 确定性输出，易重复 |
| Beam Search | 每步保留Top-K候选，选累计最大概率 | 质量较稳定，慢 |
| Top-K Sampling | 仅从概率最高的K个词中采样 | 多样性好，简单 |
| Top-p (Nucleus) Sampling | 从累计概率≥p的词中采样 | 动态调整候选集，效果好 |
| Temperature | 对logits除以T，T>1变均匀，T<1变尖锐 | 控制生成的随机性 |

**实际生产中常用：** Temperature=0.7 + Top-p=0.9（平衡质量与多样性）

### Q12: 什么是KV Cache？为什么能加速推理？

```
无KV Cache（每次计算全部）：
  生成 token1 → [0,0,0,0] 计算所有位置的K、V
  生成 token2 → [t1,0,0,0] 重新计算所有位置
  生成 token3 → [t1,t2,0,0] 重新计算
  ...（每个token都要重新计算前面所有的KV）

有KV Cache（缓存已计算结果）：
  生成 token1 → 计算K1、V1，缓存
  生成 token2 → 复用K1、V1，仅计算K2、V2，缓存
  生成 token3 → 复用K1、V1、K2、V2，仅计算K3、V3
  ...（每个新token仅计算自己的KV，前面的全部复用）
```

**效果：**
- 时间复杂度从 O(n²) 降为 O(n)（推理阶段）
- 以空间换时间，显存占用 = 2 × layers × seq_len × d_model
- 是现代LLM推理的标准优化

### Q13: Context Window（上下文窗口）是什么意思？

> 模型一次能处理的最大token数量，即Attention矩阵的最大尺寸。

**示例：**
- GPT-3.5: 4K / 16K tokens
- GPT-4: 8K / 32K / 128K tokens
- LLaMA-2 7B: 4K tokens（可扩展）
- Claude: 200K tokens

**为什么不能无限扩大？**
- **计算量**: Attention是 O(n²)，上下文每翻一倍，计算量翻四倍
- **显存**: KV Cache随n线性增长
- **质量**: 长上下文时模型容易"丢信息"，中间内容被忽略

---

## 四、主流模型演进

### Q14: GPT系列的主要改进

| 模型 | 年份 | 参数量 | 主要创新 |
|------|------|--------|---------|
| GPT-1 | 2017 | 117M | 首个Decoder-only预训练模型 |
| GPT-2 | 2019 | 1.5B | 更大规模，零样本能力，生成质量飞跃 |
| GPT-3 | 2020 | 175B | Few-shot学习，InstructGPT引入指令学习 |
| GPT-3.5 | 2022 | - | Codex代码能力，ChatGPT对话交互 |
| GPT-4 | 2023 | 1.7T*(MoE) | 多模态，更强推理，更大上下文 |

### Q15: Transformer vs BERT vs GPT 核心区别

| 维度 | Transformer | BERT | GPT |
|------|------------|------|-----|
| 架构 | Encoder-Decoder | Encoder-only | Decoder-only |
| 注意力 | Encoder双向, Decoder因果 | 双向Masked | 因果（单向） |
| 训练目标 | 序列到序列（翻译等） | Masked Language Modeling | 自回归语言建模 |
| 适用场景 | 机器翻译、摘要 | 分类、命名实体、句子关系 | 文本生成、对话、代码 |
| 代表模型 | T5、BART | BERT、RoBERTa | GPT-1/2/3/4、LLaMA |

### Q16: 什么是MoE（Mixture of Experts）？

> MoE将模型的前馈网络（FFN）替换为多个专家网络，每个token只激活少量专家。参数量大但激活参数量小。

```
GPT-4 架构（传闻）：
  - 8个专家（Experts），每个~220B参数
  - 每个token选择Top-2专家（仅激活~440B参数）
  - 总参数量 ~1.7T，但每次推理仅激活~440B

                  ┌──────────┐
                  │ Router   │ → 选择2个专家
                  └────┬─────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐   ┌──────────┐
  │ Expert 1 │  │ Expert 2 │...│ Expert 8 │
  └──────────┘  └──────────┘   └──────────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              加权求和后输出
```

**优势：**
- 计算量与参数量解耦（大模型但推理快）
- 专家专精不同领域（语法、代码、数学等）

---

## 五、核心概念补充

### Q17: Tokenizer是什么？BPE/WordPiece/SentencePiece的区别？

> Tokenizer将文本切分为子词（subwords），是模型的输入/输出接口。

| 方案 | 使用模型 | 特点 |
|------|---------|------|
| BPE (Byte-Pair) | GPT系列、LLaMA | 字节对编码，从字符开始合并高频组合 |
| WordPiece | BERT | 基于概率的子词切分 |
| SentencePiece | T5、LLaMA部分 | 包含空格的子词，无需预分词 |

**为什么需要子词？**
- 词汇表可控（如32K词表），不需要覆盖所有词
- 可以处理未见过的词（组合子词）
- 压缩词表大小，减少参数

**BPE工作原理：**
```
初始词表：所有单个字符 + 特殊符号
循环：
  1. 统计所有相邻字符对的频率
  2. 将最高频的字符合并为新token
  3. 加入词表
直到词表达到目标大小（如32,000）
```

### Q18: Layer Normalization vs Batch Normalization

| 维度 | LayerNorm | BatchNorm |
|------|-----------|-----------|
| 归一化维度 | 每个样本的特征维度 | 每个特征的batch维度 |
| 对batch size敏感 | 不敏感 | 敏感，batch小效果差 |
| 适合的场景 | NLP，序列模型 | CV，图像分类 |
| 位置 | Pre-Norm / Post-Norm | 卷积后 |

**Transformer中为什么用LayerNorm？**
- NLP中每个序列长度不同，BatchNorm不稳定
- LayerNorm对每个样本独立归一化，不受batch影响

### Q19: 残差连接（Residual Connection）的作用

```
x + SubLayer(x)
│
├── 解决梯度消失：保证梯度可以直接传播到底层
├── 保留原始信息：不丢失输入的"原始信号"
└── 简化训练：让深层网络更容易训练
```

直觉：像"旁路水管"，原始信号可以不经过变换直接传到后面，保证信息不会丢失。

### Q20: Feed-Forward Network (FFN) 为什么设计成两层？

```
FFN(x) = max(0, x·W1 + b1) · W2 + b2
      ↑
      ReLU激活

[seq_len, d_model] → [seq_len, 4×d_model] → [seq_len, d_model]
```

**设计动机：**
- Attention负责"捕捉位置间关系"
- FFN负责"逐位置的特征变换"（每个token独立处理）
- 先升维再降维，引入非线性，增强表达能力
- 4×d_model 的维度膨胀是经验值（足够的容量表达特征组合）

---

## 高频题速查

| 问题 | 一句话回答 |
|------|-----------|
| Transformer核心组件 | Multi-Head Attention + FFN + Add&Norm |
| 为什么用RoPE | 旋转位置编码，相对位置信息，推理可外推 |
| GPT vs BERT | Decoder-only（生成）vs Encoder-only（理解） |
| KV Cache作用 | 缓存已计算的KV，避免重复计算，加速推理 |
| 解码策略 | Greedy/Beam/Top-K/Top-p，各有适用场景 |
| MoE优势 | 参数量大但每次仅激活少量专家，平衡规模与速度 |
| 位置编码方式 | 绝对/正弦/RoPE/ALiBi，现代常用RoPE |
