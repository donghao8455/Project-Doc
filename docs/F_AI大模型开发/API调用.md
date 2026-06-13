# API调用

## OpenAI API

### 安装与配置

```bash
# 安装OpenAI SDK
npm install openai

# 或使用Python
pip install openai
```

### 环境配置

```bash
# 设置API密钥
export OPENAI_API_KEY="sk-xxxxx"

# 可选：设置代理（国内需要）
export HTTPS_PROXY="http://127.0.0.1:7890"
```

### 基础调用

#### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 简单对话
async function chat(prompt) {
  const response = await client.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }]
  });
  return response.choices[0].message.content;
}

// 流式输出
async function streamChat(prompt) {
  const stream = await client.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }],
    stream: true
  });
  
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
}
```

#### Python

```python
from openai import OpenAI

client = OpenAI(api_key="sk-xxxxx")

# 简单对话
response = client.chat.completions.create(
    model="gpt-4-turbo",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)

# 流式输出
stream = client.chat.completions.create(
    model="gpt-4-turbo",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## 国产模型API

### 智谱AI（GLM）

```javascript
import OpenAI from 'openai';

const zhipu = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4'
});

// 调用GLM-4
const response = await zhipu.chat.completions.create({
  model: 'glm-4',
  messages: [{ role: 'user', content: '你好' }]
});
```

### 阿里通义千问

```javascript
import OpenAI from 'openai';

const qwen = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 调用通义千问
const response = await qwen.chat.completions.create({
  model: 'qwen-turbo',
  messages: [{ role: 'user', content: '你好' }]
});
```

### 百度文心一言

```javascript
import OpenAI from 'openai';

const wenxin = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://qianfan.baidubce.com/v2'
});

const response = await wenxin.chat.completions.create({
  model: 'ernie-4.0-8k-latest',
  messages: [{ role: 'user', content: '你好' }]
});
```

## Embedding API

### 文本向量化

```javascript
// OpenAI Embedding
const embedding = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "要向量化的文本"
});

const vector = embedding.data[0].embedding;
console.log(`维度: ${vector.length}`); // text-embedding-3-small: 1536维
```

### 批量向量化

```javascript
const texts = [
  "第一段文本",
  "第二段文本",
  "第三段文本"
];

const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: texts
});

response.data.forEach((item, index) => {
  console.log(`文本${index + 1}的向量:`, item.embedding.slice(0, 5), "...");
});
```

## 错误处理

```javascript
import { RateLimitError, APIError } from 'openai';

try {
  const response = await client.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }]
  });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('请求过于频繁，等待后重试...');
    await sleep(60000);
  } else if (error instanceof APIError) {
    console.log(`API错误: ${error.status} - ${error.message}`);
  } else {
    console.log(`未知错误: ${error.message}`);
  }
}
```

## 最佳实践

### 1. 合理设置超时

```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);

const response = await client.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [{ role: "user", content: prompt }],
  signal: controller.signal
});

clearTimeout(timeout);
```

### 2. 实现重试机制

```javascript
async function chatWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: prompt }]
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // 指数退避
    }
  }
}
```

### 3. 成本优化

```javascript
// 1. 尽可能使用更小更快的模型
const useModel = useSimpleTask ? 'gpt-3.5-turbo' : 'gpt-4-turbo';

// 2. 减少不必要的上下文
const messages = [
  { role: "system", content: "简洁回答" },
  { role: "user", content: truncateLongContext(longText)) }
];

// 3. 使用压缩工具
import { tokenCounter } from './utils';

// 检查token数量
const estimatedTokens = await countTokens(prompt);
if (estimatedTokens > 100000) {
  console.log('警告：输入可能超过模型限制');
}
```
