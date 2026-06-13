# RAG概述

## 什么是RAG

RAG（Retrieval-Augmented Generation，检索增强生成）是一种结合信息检索与文本生成的技术架构，让大语言模型能够基于外部知识库生成更准确、更可靠的答案。

```
┌─────────────────────────────────────────────────────────────┐
│                       RAG 工作流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ 用户    │───▶│ 检索    │───▶│ 增强   │───▶│ 生成   │ │
│  │ Query   │    │ 模块    │    │ 上下文  │    │ 模型    │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│                      │              │                       │
│                      ▼              ▼                       │
│              ┌─────────────┐ ┌─────────────┐              │
│              │  知识库      │ │  用户问题   │              │
│              │ (Vector DB) │ │ + 检索内容   │              │
│              └─────────────┘ └─────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 为什么需要RAG

### LLM的局限性

| 问题 | 说明 | RAG解决方案 |
|------|------|-------------|
| 幻觉 | 生成看似合理但错误的内容 | 提供真实文档作为依据 |
| 知识过时 | 训练数据有时间限制 | 实时检索最新知识 |
| 私有知识 | 无法获取内部文档 | 接入私有知识库 |
| 领域知识 | 缺乏专业领域知识 | 补充领域专业知识 |
| 不可溯源 | 无法验证答案来源 | 提供引用和来源 |

### RAG vs 微调

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG vs 微调对比                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│        RAG                          微调                    │
│  ───────────                    ───────────                │
│  ✅ 快速部署                      ✅ 响应更快                 │
│  ✅ 知识更新灵活                  ✅ 模型行为稳定             │
│  ✅ 可解释性强                    ✅ 节省推理成本             │
│  ✅ 成本较低                      ⚠️ 需要大量训练数据        │
│  ⚠️ 依赖检索质量                  ⚠️ 更新成本高              │
│  ⚠️ 响应延迟较高                  ⚠️ 可能遗忘通用知识        │
│                                                             │
│  适用场景：                        适用场景：                │
│  - 知识频繁更新                    - 需要固定行为模式         │
│  - 需要可解释性                    - 垂直领域深度适配         │
│  - 知识库规模大                    - 少量标注数据             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## RAG核心组件

### 1. 文档处理

```javascript
// 文档处理流程
async function processDocument(file) {
  // 1. 读取文档
  const content = await readFile(file);
  
  // 2. 文档解析（PDF、Word、Markdown等）
  const parsed = await parseDocument(content, file.type);
  
  // 3. 文本清洗
  const cleaned = cleanText(parsed);
  
  // 4. 文档切分
  const chunks = splitIntoChunks(cleaned, {
    chunkSize: 500,
    overlap: 50
  });
  
  // 5. 生成元数据
  const metadata = extractMetadata(file, chunks);
  
  return { chunks, metadata };
}
```

### 2. 向量化

```javascript
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536
});

// 批量向量化
async function embedDocuments(chunks) {
  const vectors = await embeddings.embedDocuments(chunks);
  return chunks.map((chunk, i) => ({
    id: generateId(),
    content: chunk,
    vector: vectors[i]
  }));
}
```

### 3. 检索

```javascript
async function retrieve(query, topK = 5) {
  // 1. 向量化查询
  const queryVector = await embeddings.embedQuery(query);
  
  // 2. 向量相似度搜索
  const results = await vectorStore.search({
    vector: queryVector,
    topK: topK,
    includeMetadata: true
  });
  
  // 3. 后处理（重排序、去重）
  const processed = postProcess(results);
  
  return processed;
}
```

### 4. 生成

```javascript
async function generateWithRAG(query, retrievedDocs) {
  // 构建增强Prompt
  const context = retrievedDocs
    .map((doc, i) => `[文档${i+1}]: ${doc.content}`)
    .join('\n\n');
  
  const prompt = `
    基于以下参考资料回答问题。如果资料中没有相关信息，请说明无法回答。
    
    参考资料：
    ${context}
    
    问题：${query}
    
    回答：
  `;
  
  // 调用LLM生成
  const response = await llm.invoke(prompt);
  
  return {
    answer: response,
    sources: retrievedDocs.map(d => d.metadata)
  };
}
```

## RAG架构变体

### 1. 基础RAG

```
Query → 检索 → 简单拼接 → 生成
```

### 2. 高级RAG

```
Query → 重写 → 检索 → 重排序 → 生成
         ↑            ↑
       反思        多跳检索
```

### 3. 模块化RAG

```
┌─────────────────────────────────────────────────────────────┐
│                   模块化RAG组件                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 检索模块    │  🔄 重排模块     │  🎯 生成模块           │
│  - 语义搜索     │  - Cross-Encoder │  - 提示优化            │
│  - 关键词搜索   │  - MMR           │  - 自我反思             │
│  - 混合搜索     │  - 过滤         │  - 多答案生成           │
│                                                             │
│  📝 索引模块    │  ⚙️ 增强模块     │  📊 评估模块           │
│  - Chunk优化   │  - 查询改写      │  - RAGAS              │
│  - 元数据索引   │  - 上下文压缩    │  - TruLens            │
│  - 多向量       │  - 迭代检索      │  - 引用评估           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## RAG应用场景

| 场景 | 说明 | 示例 |
|------|------|------|
| 客服机器人 | 基于产品文档回答用户问题 | 电商售后问答 |
| 文档问答 | 从长文档中提取信息 | 合同分析 |
| 知识库搜索 | 企业内部知识检索 | 培训资料查询 |
| 医疗问答 | 辅助诊断参考 | 病例分析 |
| 法律咨询 | 法条引用与解读 | 合同审查 |
| 代码助手 | 代码库问答 | 开发文档查询 |

## RAG性能优化方向

1. **检索优化**：混合搜索、查询扩展、多跳检索
2. **索引优化**：Chunk策略、层级索引、元数据利用
3. **生成优化**：Prompt工程、引用标注、置信度评估
4. **系统优化**：缓存、并行处理、异步加载
