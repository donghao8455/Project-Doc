# Agent概述

## 什么是AI Agent

AI Agent（智能体）是一种能够自主理解目标、规划决策、执行复杂任务的智能系统。与简单的LLM调用不同，Agent具备规划、记忆和工具使用能力。

```
┌─────────────────────────────────────────────────────────────┐
│                       AI Agent 架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     ┌─────────────────┐                     │
│                     │      目标       │                     │
│                     │   用户输入/任务  │                     │
│                     └────────┬────────┘                     │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    🤖 Agent Core                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  感知    │  │  规划    │  │  行动    │          │   │
│  │  │ (Perceive)│  │ (Planning)│  │ (Action) │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│           ┌──────────────────┼──────────────────┐          │
│           ▼                  ▼                  ▼          │
│    ┌───────────┐     ┌───────────┐     ┌───────────┐      │
│    │   记忆    │     │   工具    │     │   执行    │      │
│    │ (Memory)  │     │ (Tools)   │     │ (Action)  │      │
│    └───────────┘     └───────────┘     └───────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Agent vs 传统LLM

| 特性 | 传统LLM | AI Agent |
|------|---------|----------|
| 交互方式 | 一次性输入输出 | 多轮交互、自主决策 |
| 工具使用 | 不可用 | 可调用外部工具 |
| 任务执行 | 单一响应 | 多步骤规划执行 |
| 自我反思 | 无 | 具备反思能力 |
| 记忆能力 | 无状态 | 持久记忆 |
| 适用场景 | 问答、生成 | 复杂任务自动化 |

## Agent核心组件

### 1. 规划（Planning）

```python
class AgentPlanning:
    """Agent规划能力"""
    
    def __init__(self, llm):
        self.llm = llm
    
    async def decompose_task(self, task):
        """
        任务分解：将复杂任务拆分为子任务
        """
        prompt = f"""
        请将以下任务分解为可执行的子任务：
        
        任务：{task}
        
        要求：
        1. 每个子任务应该清晰可执行
        2. 考虑任务间的依赖关系
        3. 标注关键步骤
        
        输出格式：
        [
            {{"id": 1, "task": "子任务1", "depends_on": []}},
            {{"id": 2, "task": "子任务2", "depends_on": [1]}},
            ...
        ]
        """
        
        response = await self.llm.invoke(prompt)
        return json.loads(response)
    
    async def plan_with_reflection(self, task, max_retries=2):
        """
        带反思的规划：检查计划可行性
        """
        plan = await self.decompose_task(task)
        
        for retry in range(max_retries):
            # 检查计划
            review = await self.review_plan(plan)
            
            if review["valid"]:
                return plan
            
            # 根据反馈改进
            plan = await self.improve_plan(plan, review["issues"])
        
        return plan
    
    async def review_plan(self, plan):
        """审查计划可行性"""
        prompt = f"""
        请审查以下计划，检查：
        1. 逻辑是否正确
        2. 步骤是否完整
        3. 是否有遗漏
        
        计划：{json.dumps(plan, ensure_ascii=False)}
        
        输出：
        {{
            "valid": true/false,
            "issues": ["问题1", "问题2"],
            "suggestions": ["建议1", "建议2"]
        }}
        """
        
        response = await self.llm.invoke(prompt)
        return json.loads(response)
```

### 2. 记忆（Memory）

```python
class AgentMemory:
    """Agent记忆管理"""
    
    def __init__(self, vector_store=None):
        self.short_term = []      # 短期记忆：对话历史
        self.long_term = vector_store or Chroma()  # 长期记忆：向量存储
        self.max_short_term = 10  # 短期记忆上限
    
    def add_short_term(self, content, role="user"):
        """添加短期记忆"""
        self.short_term.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now()
        })
        
        # 超出上限时，摘要化旧内容
        if len(self.short_term) > self.max_short_term:
            self.compact_short_term()
    
    def add_long_term(self, content, metadata=None):
        """添加长期记忆"""
        vector = embeddings.embed_query(content)
        self.long_term.add({
            "id": str(uuid.uuid4()),
            "vector": vector,
            "content": content,
            "metadata": metadata or {}
        })
    
    async def retrieve_long_term(self, query, k=5):
        """检索长期记忆"""
        query_vector = embeddings.embed_query(query)
        results = await self.long_term.search(
            vector=query_vector,
            k=k
        )
        return results
    
    def compact_short_term(self):
        """压缩短期记忆"""
        # 将较早的对话摘要化
        old_memories = self.short_term[:-self.max_short_term//2]
        summary = summarize_memories(old_memories)
        
        self.add_long_term(summary, {"type": "conversation_summary"})
        self.short_term = self.short_term[-self.max_short_term//2:]
```

### 3. 工具（Tools）

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseTool(ABC):
    """工具基类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> Dict:
        """返回工具参数schema"""
        pass
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        pass

class CalculatorTool(BaseTool):
    """计算器工具"""
    
    @property
    def name(self) -> str:
        return "calculator"
    
    @property
    def description(self) -> str:
        return "执行数学计算，支持加减乘除、幂运算等"
    
    @property
    def parameters(self) -> Dict:
        return {
            "expression": {
                "type": "string",
                "description": "数学表达式，如 '2+3*5'",
                "required": True
            }
        }
    
    async def execute(self, expression: str) -> str:
        try:
            result = eval(expression)
            return f"计算结果：{result}"
        except Exception as e:
            return f"计算错误：{e}"
```

## Agent开发框架

### LangChain Agent

```python
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

# 定义工具
@tool
def search_web(query: str) -> str:
    """搜索互联网获取信息"""
    # 实现搜索逻辑
    return f"搜索结果：{query}的相关信息..."

@tool
def calculator(expression: str) -> str:
    """执行数学计算"""
    return str(eval(expression))

# 创建Agent
tools = [search_web, calculator]

prompt = hub.pull("hwchase17/openai-functions-agent")

llm = ChatOpenAI(model="gpt-4-turbo")

agent = create_openai_functions_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=10
)

# 执行
result = await agent_executor.ainvoke({
    "input": "计算 (25 * 4) + 100，然后搜索结果"
})
```

### 自定义Agent架构

```python
class CustomAgent:
    """自定义Agent实现"""
    
    def __init__(self, llm, tools, memory):
        self.llm = llm
        self.tools = tools
        self.memory = memory
        self.tool_schemas = self._generate_tool_schemas()
    
    async def run(self, task: str):
        """运行Agent"""
        history = self.memory.get_recent_history()
        
        # 构建Prompt
        prompt = self._build_prompt(task, history)
        
        # LLM决策
        response = await self.llm.invoke(prompt)
        
        # 解析响应，执行动作或返回结果
        action = self._parse_action(response)
        
        if action["type"] == "tool_call":
            return await self._execute_tool(action)
        elif action["type"] == "final_answer":
            return action["content"]
    
    async def _execute_tool(self, action):
        """执行工具"""
        tool_name = action["tool"]
        params = action["parameters"]
        
        # 查找工具
        tool = self._find_tool(tool_name)
        if not tool:
            return f"未找到工具：{tool_name}"
        
        # 执行
        result = await tool.execute(**params)
        
        # 记录到记忆
        self.memory.add_tool_result(tool_name, result)
        
        # 继续执行
        return await self.run(f"根据工具执行结果继续：{result}")
```

## Agent类型

### 1. 反应式Agent（Reactive）

```python
class ReactiveAgent:
    """简单反应式Agent：直接响应，无复杂规划"""
    
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
    
    async def respond(self, user_input):
        # 直接根据输入选择工具执行
        response = await self.llm.with_tools(self.tools).invoke(user_input)
        return response
```

### 2. 目标导向Agent（Goal-Oriented）

```python
class GoalOrientedAgent:
    """目标导向Agent：分解目标，逐步执行"""
    
    async def achieve_goal(self, goal):
        # 1. 分解目标
        subgoals = await self.planner.decompose(goal)
        
        # 2. 逐个完成
        for subgoal in subgoals:
            await self.execute subgoal
            
            # 3. 检查进度
            if not self.is_on_track(goal):
                # 4. 重新规划
                subgoals = await self.replan(subgoals)
```

### 3. 学习型Agent（Learning）

```python
class LearningAgent:
    """学习型Agent：从经验中学习"""
    
    def __init__(self, agent, memory):
        self.agent = agent
        self.memory = memory
    
    async def run_with_learning(self, task):
        try:
            result = await self.agent.run(task)
            
            # 评估结果
            quality = await self.evaluate(result)
            
            if quality < 0.8:
                # 从错误中学习
                await self.learn_from_mistake(task, result)
            
            return result
        except Exception as e:
            await self.learn_from_error(task, str(e))
            raise
```

## Agent应用场景

| 场景 | Agent能力 | 示例 |
|------|----------|------|
| 个人助理 | 多工具协调 | 日程管理、邮件处理 |
| 自动化流程 | 任务规划执行 | 数据处理、报告生成 |
| 智能客服 | 对话+知识检索 | 产品咨询、售后支持 |
| 代码助手 | 代码生成+调试 | PR审查、Bug修复 |
| 研究助手 | 信息检索+分析 | 文献综述、数据分析 |
| 控制系统 | 实时决策+执行 | 智能家居、工业控制 |

## 开发最佳实践

```
┌─────────────────────────────────────────────────────────────┐
│                   Agent 开发 Checklist                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 清晰的工具设计：每个工具职责单一、接口清晰               │
│  ✅ 完善的错误处理：工具失败时降级或重试                     │
│  ✅ 记忆管理策略：合理平衡短期/长期记忆                     │
│  ✅ 安全性考虑：工具调用权限控制、输入验证                   │
│  ✅ 可观测性：日志记录、执行追踪                            │
│  ✅ 成本控制：限制迭代次数、缓存结果                        │
│  ✅ 评估机制：结果质量评估、持续优化                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
