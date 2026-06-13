# 多Agent协作

## Multi-Agent概述

多Agent系统是由多个独立Agent组成的协作网络，每个Agent负责特定职责，通过协作完成复杂任务。

```
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Agent 协作架构                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                        ┌──────────────┐                     │
│                        │   用户请求   │                     │
│                        └──────┬───────┘                     │
│                               │                             │
│                               ▼                             │
│                     ┌─────────────────┐                     │
│                     │   Orchestrator   │  ← 协调者Agent     │
│                     │   (任务编排)     │                     │
│                     └────────┬────────┘                     │
│                              │                              │
│              ┌───────────────┼───────────────┐              │
│              ▼               ▼               ▼              │
│       ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│       │ Planner  │    │  Writer  │    │ Reviewer │         │
│       │  Agent   │    │  Agent   │    │  Agent   │         │
│       │ (规划)   │───▶│ (写作)   │───▶│ (审核)   │         │
│       └──────────┘    └──────────┘    └──────────┘         │
│                                                             │
│                        └──────────────┘                     │
│                               │                             │
│                               ▼                             │
│                        ┌──────────────┐                     │
│                        │   最终输出   │                     │
│                        └──────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Agent间通信

### 消息传递机制

```python
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional
from datetime import datetime

class MessageType(Enum):
    REQUEST = "request"          # 请求
    RESPONSE = "response"        # 响应
    BROADCAST = "broadcast"      # 广播
    DELIVER = "deliver"         # 投递

@dataclass
class AgentMessage:
    """Agent间消息"""
    id: str
    sender: str           # 发送者ID
    receivers: list       # 接收者ID列表
    type: MessageType
    content: Any
    metadata: Dict
    timestamp: datetime
    
    def to_dict(self):
        return {
            "id": self.id,
            "sender": self.sender,
            "receivers": self.receivers,
            "type": self.type.value,
            "content": self.content,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }

class MessageBus:
    """消息总线：Agent间通信中枢"""
    
    def __init__(self):
        self.agents = {}
        self.message_queue = []
    
    def register(self, agent):
        """注册Agent"""
        self.agents[agent.id] = agent
    
    async def send(self, message: AgentMessage):
        """发送消息"""
        self.message_queue.append(message)
        
        # 根据接收者分发
        for receiver_id in message.receivers:
            if receiver_id in self.agents:
                await self.agents[receiver_id].receive(message)
    
    async def broadcast(self, sender_id: str, content: Any):
        """广播消息"""
        message = AgentMessage(
            id=str(uuid.uuid4()),
            sender=sender_id,
            receivers=list(self.agents.keys()),
            type=MessageType.BROADCAST,
            content=content,
            metadata={},
            timestamp=datetime.now()
        )
        await self.send(message)
```

## 协作模式

### 1. 顺序执行模式

```python
class SequentialAgent:
    """顺序执行：Agent链式协作"""
    
    def __init__(self, agents: List, message_bus: MessageBus):
        self.agents = {a.id: a for a in agents}
        self.bus = message_bus
        self.execution_order = [a.id for a in agents]
    
    async def execute(self, task: str) -> Any:
        """
        顺序执行流程：
        Agent1 → Agent2 → Agent3 → ... → 最终结果
        """
        context = {"task": task, "results": {}}
        
        for agent_id in self.execution_order:
            agent = self.agents[agent_id]
            
            # 执行Agent任务
            result = await agent.execute(context)
            
            # 存储结果传递给下一个Agent
            context["results"][agent_id] = result
            context["input"] = result
        
        return context["results"]
```

### 2. 并行执行模式

```python
class ParallelAgent:
    """并行执行：多个Agent同时工作"""
    
    async def execute(self, task: str, agents: List) -> List[Any]:
        """并行执行多个Agent"""
        
        # 创建并行任务
        tasks = [agent.execute(task) for agent in agents]
        
        # 并行执行
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理异常
        successful = [r for r in results if not isinstance(r, Exception)]
        failed = [r for r in results if isinstance(r, Exception)]
        
        if failed:
            print(f"部分Agent执行失败: {failed}")
        
        return successful
```

### 3. 层次协作模式

```python
class HierarchicalAgent:
    """层次协作：Supervisor + Sub-Agents"""
    
    def __init__(self, supervisor: Any, sub_agents: Dict[str, Any]):
        self.supervisor = supervisor  # 主控Agent
        self.sub_agents = sub_agents  # 子Agent字典
    
    async def execute(self, task: str):
        """
        层次执行：
        1. Supervisor分解任务
        2. 分发给Sub-Agents
        3. 汇总结果
        """
        # 1. Supervisor规划
        plan = await self.supervisor.plan(task)
        
        # 2. 根据计划分配任务
        assignments = plan["assignments"]  # {sub_agent_id: sub_task}
        
        # 3. 并行执行子任务
        sub_results = await asyncio.gather(*[
            self.sub_agents[agent_id].execute(sub_task)
            for agent_id, sub_task in assignments.items()
        ])
        
        # 4. Supervisor汇总
        final_result = await self.supervisor.synthesize(
            {k: v for k, v in zip(assignments.keys(), sub_results)}
        )
        
        return final_result
```

## 协作框架实现

### 1. 角色扮演Agent系统

```python
class RolePlayingSystem:
    """角色扮演Agent系统"""
    
    def __init__(self):
        self.roles = {
            "planner": PlannerAgent(),
            "researcher": ResearcherAgent(),
            "writer": WriterAgent(),
            "reviewer": ReviewerAgent()
        }
        self.message_bus = MessageBus()
        
        # 注册所有Agent
        for id, agent in self.roles.items():
            agent.id = id
            self.message_bus.register(agent)
    
    async def collaborate(self, task: str) -> str:
        """
        协作完成复杂任务
        """
        # 1. 规划阶段
        plan = await self.roles["planner"].create_plan(task)
        
        # 2. 研究阶段
        research_results = await self.parallel_execute(
            ["researcher"],
            plan["research_tasks"]
        )
        
        # 3. 写作阶段
        draft = await self.roles["writer"].write(
            task=task,
            research=research_results
        )
        
        # 4. 审核阶段
        feedback = await self.roles["reviewer"].review(draft)
        
        # 5. 根据反馈迭代
        if feedback["needs_revision"]:
            draft = await self.roles["writer"].revise(
                draft, feedback["suggestions"]
            )
            feedback = await self.roles["reviewer"].review(draft)
        
        return draft
    
    async def parallel_execute(self, agent_ids: List[str], tasks: List[str]) -> List:
        """并行执行多个Agent"""
        tasks_list = [
            self.roles[agent_id].execute(task)
            for agent_id, task in zip(agent_ids, tasks)
        ]
        return await asyncio.gather(*tasks_list)
```

### 2. 辩论系统

```python
class DebateSystem:
    """Agent辩论系统"""
    
    def __init__(self, agent_a: Any, agent_b: Any, judge: Any):
        self.agent_a = agent_a
        self.agent_b = agent_b
        self.judge = judge
        self.max_rounds = 3
    
    async def debate(self, topic: str) -> Dict:
        """
        Agent辩论，最终由Judge裁决
        """
        statements = {"a": [], "b": []}
        
        for round_num in range(self.max_rounds):
            # Agent A陈述
            statement_a = await self.agent_a.argue(
                topic=topic,
                opponent_view=statements["b"][-1] if statements["b"] else None
            )
            statements["a"].append(statement_a)
            
            # Agent B陈述
            statement_b = await self.agent_b.argue(
                topic=topic,
                opponent_view=statement_a
            )
            statements["b"].append(statement_b)
        
        # Judge裁决
        verdict = await self.judge.decide(
            topic=topic,
            arguments_a=statements["a"],
            arguments_b=statements["b"]
        )
        
        return {
            "statements": statements,
            "verdict": verdict,
            "rounds": self.max_rounds
        }
```

## 任务分配策略

### 1. 基于能力的分配

```python
class CapabilityBasedAllocator:
    """基于能力的任务分配"""
    
    def __init__(self, agents: List[Agent]):
        self.agents = {a.id: a for a in agents}
        self.capabilities = self._build_capability_matrix(agents)
    
    def _build_capability_matrix(self, agents: List[Agent]) -> Dict:
        """构建Agent能力矩阵"""
        return {
            agent.id: {
                "coding": agent.coding_ability,
                "writing": agent.writing_ability,
                "analysis": agent.analysis_ability,
                "research": agent.research_ability
            }
            for agent in agents
        }
    
    def allocate(self, task: Dict) -> str:
        """分配任务给最合适的Agent"""
        required_capabilities = task.get("required_capabilities", [])
        
        best_agent = None
        best_score = -1
        
        for agent_id, caps in self.capabilities.items():
            score = sum(caps.get(cap, 0) for cap in required_capabilities)
            
            if score > best_score:
                best_score = score
                best_agent = agent_id
        
        return best_agent
```

### 2. 负载均衡分配

```python
class LoadBalancedAllocator:
    """负载均衡的任务分配"""
    
    def __init__(self, agents: List[Agent]):
        self.agents = {a.id: a for a in agents}
    
    async def allocate(self, task: Dict) -> str:
        """分配给当前负载最低的Agent"""
        loads = {}
        
        for agent_id, agent in self.agents.items():
            # 获取Agent当前负载
            current_load = await agent.get_current_load()
            # 获取Agent处理该任务的能力评分
            capability_score = await agent.score_task(task)
            
            # 综合评分 = 能力 * (1 / 负载)
            loads[agent_id] = capability_score / (current_load + 1)
        
        # 返回评分最高的Agent
        return max(loads.items(), key=lambda x: x[1])[0]
```

## 冲突处理

### 1. 意见不一致

```python
class ConflictResolver:
    """冲突解决器"""
    
    async def resolve(self, agent_a_view: str, agent_b_view: str) -> str:
        """
        解决两个Agent的意见冲突
        """
        prompt = f"""
        请分析以下两个观点，找出共同点并给出综合结论：
        
        观点A：{agent_a_view}
        
        观点B：{agent_b_view}
        
        要求：
        1. 识别双方的核心分歧
        2. 找出可以调和的共同点
        3. 给出中立且有价值的综合结论
        """
        
        response = await llm.invoke(prompt)
        return response
```

### 2. 结果合并

```python
class ResultMerger:
    """结果合并器"""
    
    async def merge(self, results: List[Any], merge_strategy: str = "auto") -> Any:
        """
        合并多个Agent的结果
        """
        if merge_strategy == "concatenate":
            # 简单拼接
            return "\n\n".join(results)
        
        elif merge_strategy == "summarize":
            # LLM综合摘要
            return await self._summarize(results)
        
        elif merge_strategy == "vote":
            # 投票选最佳
            return await self._vote(results)
        
        else:
            # 自动选择最合适的策略
            return await self._auto_merge(results)
```

## 协作监控与调试

```python
class CollaborationMonitor:
    """协作监控"""
    
    def __init__(self):
        self.execution_log = []
        self.metrics = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "avg_execution_time": 0
        }
    
    async def log_execution(self, agent_id: str, task: str, result: Any, duration: float):
        """记录执行日志"""
        self.execution_log.append({
            "agent_id": agent_id,
            "task": task,
            "result_preview": str(result)[:100],
            "duration": duration,
            "timestamp": datetime.now()
        })
        
        self.metrics["total_tasks"] += 1
        self.metrics["completed_tasks"] += 1
    
    def get_metrics(self) -> Dict:
        """获取监控指标"""
        return {
            **self.metrics,
            "success_rate": self.metrics["completed_tasks"] / max(1, self.metrics["total_tasks"]),
            "recent_executions": self.execution_log[-10:]
        }
```

## Multi-Agent应用场景

| 场景 | Agent配置 | 协作模式 |
|------|----------|----------|
| 复杂文档生成 | Planner+Writer+Reviewer | 顺序 |
| 代码审查 | Author+Reviewer+SecurityExpert | 并行 |
| 投资分析 | DataCollector+Analyst+RiskManager | 层次 |
| 客户服务 | Classifier+FAQ_Agent+Order_Agent+Refund_Agent | 路由 |
| 研究报告 | Researcher+Writer+FactChecker+Editor | 顺序+迭代 |

## 最佳实践

```
┌─────────────────────────────────────────────────────────────┐
│               Multi-Agent 开发 Checklist                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 明确定义每个Agent的职责边界                             │
│  ✅ 设计清晰的消息协议和通信格式                           │
│  ✅ 实现统一的任务协调机制                                 │
│  ✅ 设置Agent数量上限，避免过度复杂                       │
│  ✅ 实现超时和错误处理机制                               │
│  ✅ 添加执行日志和监控，便于调试                         │
│  ✅ 根据任务复杂度选择合适的协作模式                     │
│  ✅ 考虑Agent间的依赖关系，优化执行顺序                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
