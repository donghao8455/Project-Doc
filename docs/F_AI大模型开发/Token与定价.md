# Token与定价

## Token概念

### 什么是Token

Token是大语言模型处理文本的基本单位，不是按字数计算，而是按词元分割。

```
┌─────────────────────────────────────────────────────────────┐
│                    Token 计算示例                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  英文示例：                                                   │
│  "hello world"  →  2 tokens (每个单词 ≈ 1 token)           │
│  "a"           →  1 token                                   │
│  "apple"       →  1 token                                   │
│                                                             │
│  中文示例：                                                   │
│  "你好"        →  2 tokens (通常1个汉字 ≈ 1-2 tokens)        │
│  "人工智能"    →  3-4 tokens                                │
│                                                             │
│  代码示例：                                                   │
│  "function"    →  1 token                                   │
│  "{"          →  1 token                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 估算规则

| 内容类型 | 每1000字 ≈ Token数 | 说明 |
|---------|-------------------|------|
| 英文文本 | 750-1000 | 英文单词平均4字符 |
| 中文文本 | 500-800 | 中文通常2-3字符占1 token |
| 代码 | 600-800 | 代码结构紧凑 |
| 混合文本 | 600-1000 | 根据实际比例 |

## Token计算工具

### 1. OpenAI官方工具

```javascript
import { encode, decode } from 'gpt-4-tokenizer';

const text = "这是一段测试文本";
const tokens = encode(text);

console.log(`文本: ${text}`);
console.log(`Token数: ${tokens.length}`);
console.log(`Token IDs: ${tokens}`);
```

### 2. Python版本

```python
import tiktoken

# 使用GPT-4编码器
enc = tiktoken.get_encoding("cl100k_base")

text = "这是一段测试文本"
tokens = enc.encode(text)

print(f"Token数: {len(tokens)}")
print(f"Token IDs: {tokens}")

# 解码还原
decoded = enc.decode(tokens)
print(f"还原文本: {decoded}")
```

### 3. 在线工具

- [OpenAI Tokenizer](https://platform.openai.com/tokenizer)
- [Tokenizer GUI](https://tiktokenizer.vercel.app/)

## API定价参考

### OpenAI模型定价

| 模型 | 输入 | 输出 | 上下文 |
|------|------|------|--------|
| GPT-4o | $2.5/1M | $10/1M | 128K |
| GPT-4o-mini | $0.15/1M | $0.60/1M | 128K |
| GPT-4 Turbo | $10/1M | $30/1M | 128K |
| GPT-3.5 Turbo | $0.50/1M | $1.50/1M | 16K |

### 国产模型定价（参考）

| 模型 | 输入 | 输出 | 说明 |
|------|------|------|------|
| GLM-4 | ¥0.1/千Tokens | ¥0.1/千Tokens | 智谱AI |
| 文心一言4.0 | ¥0.12/千Tokens | ¥0.12/千Tokens | 百度 |
| 通义千问 | ¥0.002/千Tokens | ¥0.006/千Tokens | 阿里开源 |
| Kimi | ¥0.05/千Tokens | ¥0.15/千Tokens | 月之暗面 |

## 成本优化策略

### 1. 合理选择模型

```javascript
// 根据任务复杂度选择模型
function selectModel(taskType) {
  if (taskType === 'simple') {
    return 'gpt-4o-mini'; // 简单任务用小模型
  } else if (taskType === 'complex') {
    return 'gpt-4o'; // 复杂任务用大模型
  }
}

// 使用国产模型降低成本
const useLocalModel = useChinese && budgetLimited;
const model = useLocalModel ? 'glm-4' : 'gpt-4';
```

### 2. 优化Prompt减少Token

```javascript
// ❌ 冗长Prompt
const prompt1 = `
  请你作为一个非常专业且经验丰富的JavaScript开发人员，
  拥有超过10年的编程经验，专注于前端开发领域，
  请帮我分析和解释以下代码...
`;

// ✅ 精简Prompt
const prompt2 = `
  作为资深前端开发，分析以下JS代码的问题：
`;
```

### 3. 上下文压缩

```javascript
// 长文档处理策略
async function processLongDocument(doc) {
  // 1. 摘要提取
  const summary = await summarize(doc);
  
  // 2. 分段处理
  const chunks = splitIntoChunks(doc, 4000); // 每段约4000字
  
  // 3. 逐段处理
  const results = [];
  for (const chunk of chunks) {
    const result = await processChunk(summary + chunk);
    results.push(result);
  }
  
  // 4. 汇总结果
  return aggregateResults(results);
}
```

### 4. 缓存常用结果

```javascript
const cache = new Map();

// 检查缓存
function getCachedResponse(prompt) {
  const hash = hashPrompt(prompt);
  return cache.get(hash);
}

// 缓存结果
function cacheResponse(prompt, response) {
  const hash = hashPrompt(prompt);
  cache.set(hash, {
    response,
    timestamp: Date.now()
  });
}

// 清理过期缓存
function cleanExpiredCache(maxAge = 3600000) {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.timestamp > maxAge) {
      cache.delete(key);
    }
  }
}
```

### 5. 使用流式输出

```javascript
// 流式输出不等待完整响应
async function* streamResponse(prompt) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true
  });
  
  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content || '';
  }
}

// 使用
for await (const text of streamResponse(prompt)) {
  process.stdout.write(text);
}
```

## 预算监控

### 1. 记录Token使用

```javascript
class TokenTracker {
  constructor() {
    this.totalTokens = 0;
    this.totalCost = 0;
    this.history = [];
  }
  
  async track(prompt, fn) {
    const start = Date.now();
    const startTokens = await this.countTokens(prompt);
    
    const result = await fn();
    
    const responseTokens = await this.countTokens(result);
    const totalTokens = startTokens + responseTokens;
    const cost = this.calculateCost(totalTokens);
    
    this.history.push({
      prompt: prompt.substring(0, 50),
      tokens: totalTokens,
      cost,
      duration: Date.now() - start
    });
    
    this.totalTokens += totalTokens;
    this.totalCost += cost;
    
    return result;
  }
  
  getReport() {
    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      requestCount: this.history.length,
      avgCostPerRequest: this.totalCost / this.history.length
    };
  }
}
```

### 2. 设置预算限制

```javascript
class BudgetController {
  constructor(monthlyBudget) {
    this.monthlyBudget = monthlyBudget;
    this.monthStartTokens = 0;
  }
  
  async checkBudget() {
    const currentTokens = await this.getCurrentMonthTokens();
    const estimatedCost = this.calculateCost(currentTokens);
    
    if (estimatedCost >= this.monthlyBudget * 0.9) {
      console.warn(`⚠️ 预算使用已达${(estimatedCost/this.monthlyBudget*100).toFixed(1)}%`);
    }
    
    if (estimatedCost >= this.monthlyBudget) {
      throw new Error('月度预算已用尽，请等待下个计费周期');
    }
  }
}
```

## 最佳实践总结

```
┌─────────────────────────────────────────────────────────────┐
│                   Token 成本优化 Checklist                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 根据任务选择合适大小的模型                                 │
│  ✅ 精简Prompt，避免冗余描述                                  │
│  ✅ 长文本使用摘要或分段处理                                   │
│  ✅ 缓存重复请求的结果                                        │
│  ✅ 使用流式输出优化体验                                      │
│  ✅ 监控Token使用，设置预算告警                               │
│  ✅ 考虑使用国产模型降低成本                                  │
│  ✅ 批量处理时合并请求                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
