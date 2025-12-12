## ELK的常用查询语法有哪些

Elasticsearch（ELK中的核心组件）的查询语法基于JSON格式的**查询DSL（Domain Specific Language）**，常用查询可分为**叶子查询（单字段查询）** 和**复合查询（多条件组合）** 两大类。以下是最常用的查询语法及示例：


### 一、基础查询（叶子查询）
针对单个字段的匹配逻辑，直接作用于具体字段。

#### 1. 精确匹配（`term`/`terms`）
- `term`：精确匹配单个值（适用于**非文本类型**或`keyword`子字段，不进行分词）。
- `terms`：精确匹配多个值（类似`IN`）。

```json
# term查询：匹配price=399的文档
{ "query": { "term": { "price": 399 } } }

# terms查询：匹配seatCount为2或4的文档
{ "query": { "terms": { "seatCount": [2, 4] } } }

# 文本字段精确匹配（需用.keyword子字段）
{ "query": { "term": { "flightNum.keyword": "CA1234" } } }
```


#### 2. 全文匹配（`match`/`multi_match`）
- `match`：对文本字段进行分词后匹配（适用于**文本类型**，会按分词器拆分查询词）。
- `multi_match`：在多个字段中执行`match`查询。

```json
# match查询：匹配dep字段包含“北京”的文档（分词后匹配）
{ "query": { "match": { "dep": "北京" } } }

# multi_match：在dep或arr字段中匹配“上海”
{ "query": { "multi_match": { "query": "上海", "fields": ["dep", "arr"] } } }
```


#### 3. 范围查询（`range`）
匹配字段值在指定范围内的文档，支持数字、日期等类型。

```json
# 数字范围：price在300到500之间（包含边界）
{ "query": { "range": { "price": { "gte": 300, "lte": 500 } } } }

# 日期范围：newDataCreateTime在2024-01-01到2024-01-31之间
{ "query": { "range": { "newDataCreateTime": { "gte": "2024-01-01", "lte": "2024-01-31" } } } }
```

- 操作符：`gt`（>）、`gte`（>=）、`lt`（<）、`lte`（<=）。


#### 4. 前缀查询（`prefix`）
匹配字段以指定前缀开头的文档（适用于`keyword`字段或非分词字段）。

```json
# 匹配flightNum以“CA”开头的文档（需用.keyword）
{ "query": { "prefix": { "flightNum.keyword": "CA" } } }
```


#### 5. 通配符查询（`wildcard`）
支持`*`（任意字符序列）和`?`（单个字符）的模糊匹配（性能较低，慎用）。

```json
# 匹配flightNum以“CA”开头且长度为5的文档（如CA123）
{ "query": { "wildcard": { "flightNum.keyword": "CA???", "boost": 1.0 } } }
```


### 二、复合查询（多条件组合）
将多个叶子查询或复合查询组合，实现复杂逻辑。

#### 1. 布尔查询（`bool`）
最常用的复合查询，通过`must`/`should`/`must_not`/`filter`组合条件：
- `must`：必须满足（影响相关性得分）。
- `should`：至少满足一个（类似`OR`）。
- `must_not`：必须不满足（不影响得分）。
- `filter`：必须满足（不影响得分，可缓存，性能更好）。

```json
# 示例：查询CA1234航班、2024-05-01出发、价格300-500的文档
{
  "query": {
    "bool": {
      "must": [
        { "term": { "flightNum.keyword": "CA1234" } },
        { "term": { "depDate": "2024-05-01" } }
      ],
      "filter": [
        { "range": { "price": { "gte": 300, "lte": 500 } } }
      ]
    }
  }
}
```


#### 2. 提升查询（`boosting`）
降低某些匹配文档的相关性得分（而非完全排除）。

```json
# 示例：匹配“北京”的文档，但降低包含“特价”的文档得分
{
  "query": {
    "boosting": {
      "positive": { "match": { "dep": "北京" } },  // 主匹配条件
      "negative": { "match": { "title": "特价" } }, // 需降低得分的条件
      "negative_boost": 0.5  // 降低后的权重（0-1之间）
    }
  }
}
```


### 三、聚合查询（`aggs`）
类似SQL的`GROUP BY`，用于统计分析（如分组、求和、平均值等）。

#### 1. 分组聚合（`terms`）
按字段值分组，类似`GROUP BY`。

```json
# 示例：按seatCount分组，统计每组文档数
{
  "size": 0,  // 不返回原始数据
  "aggs": {
    "group_by_seat": {  // 聚合名称（自定义）
      "terms": { "field": "seatCount" }  // 分组字段
    }
  }
}
```


#### 2. 嵌套聚合（子分组）
在分组内再进行子分组，类似`GROUP BY a, b`。

```json
# 示例：先按seatCount分组，再按price分组
{
  "size": 0,
  "aggs": {
    "group_by_seat": {
      "terms": { "field": "seatCount" },
      "aggs": {  // 子聚合
        "group_by_price": {
          "terms": { "field": "price" }
        }
      }
    }
  }
}
```


#### 3. 指标聚合（`stats`/`avg`/`sum`等）
计算分组内的统计指标（平均值、总和、最大值等）。

```json
# 示例：按seatCount分组，计算每组价格的平均值和总和
{
  "size": 0,
  "aggs": {
    "group_by_seat": {
      "terms": { "field": "seatCount" },
      "aggs": {
        "price_avg": { "avg": { "field": "price" } },  // 平均值
        "price_sum": { "sum": { "field": "price" } }   // 总和
      }
    }
  }
}
```


### 四、排序与分页
#### 1. 排序（`sort`）
按指定字段排序，支持多字段排序。

```json
# 示例：按price升序，再按newDataCreateTime降序
{
  "query": { "match_all": {} },  // 匹配所有文档
  "sort": [
    { "price": { "order": "asc" } },
    { "newDataCreateTime": { "order": "desc" } }
  ]
}
```


#### 2. 分页（`from`/`size`）
- `from`：起始位置（默认0）。
- `size`：返回条数（默认10，最大10000，超大数据量建议用`scroll`或`search_after`）。

```json
# 示例：查询第2页数据（每页10条）
{
  "query": { "match_all": {} },
  "from": 10,  // 跳过前10条
  "size": 10   // 返回10条
}
```


### 五、其他常用语法
#### 1. 匹配所有文档（`match_all`）
查询所有文档，常用于全量统计或配合过滤条件。

```json
{ "query": { "match_all": {} } }
```


#### 2. 存在查询（`exists`）
匹配指定字段存在的文档（非`null`）。

```json
# 示例：查询包含brandName字段的文档
{ "query": { "exists": { "field": "brandName" } } }
```


#### 3. 模糊查询（`fuzzy`）
允许输入词有拼写错误（最多2个字符差异），适用于容错场景。

```json
# 示例：匹配dep字段与“北就”相似的文档（容错“京”→“就”）
{ "query": { "fuzzy": { "dep": "北就" } } }
```


### 总结
- 精确匹配用`term`/`terms`（配合`keyword`字段），全文匹配用`match`。
- 多条件组合用`bool`查询，`filter`子句适合过滤且性能更好。
- 统计分析用`aggs`聚合，支持分组和指标计算。
- 分页排序通过`from`/`size`和`sort`实现，大数据量需注意性能。

实际使用时，可通过Kibana的Dev Tools调试查询，或结合`RestHighLevelClient`在代码中构建查询。
