## MongoDB 查询日志-查询语句 分析优化

错误日志示例：
```
{
    "op": "query",
    "ns": "spider.spiderIntermediateTable",
    "planSummary": "COLLSCAN",
    "nreturned": 100,
    "responseLength": 71762,
    "nBatches": 1,
    "storage": {
        "data": {
            "timeReadingMicros": {
                "$numberLong": "11369"
            },
            "bytesRead": {
                "$numberLong": "146583004"
            }
        }
    },
    "locks": {
        "FeatureCompatibilityVersion": {
            "acquireCount": {
                "r": {
                    "$numberLong": "5327"
                }
            }
        },
        "Global": {
            "acquireCount": {
                "r": {
                    "$numberLong": "5327"
                }
            }
        }
    },
    "flowControl": {},
    "command": {
        "filter": {},
        "lsid": {
            "id": {
                "$binary": "ZRU6isTSTcKVkV4JUx+F/w==",
                "$type": "04"
            }
        },
        "$db": "spider",
        "$clusterTime": {
            "clusterTime": {
                "$timestamp": {
                    "t": 1759988894,
                    "i": 467
                }
            },
            "signature": {
                "keyId": {
                    "$numberLong": "7501180697659310363"
                },
                "hash": {
                    "$binary": "RqXWv6ip3VazXy73mfVKAJWRlyU=",
                    "$type": "00"
                }
            }
        },
        "find": "spiderIntermediateTable",
        "limit": {
            "$numberLong": "100"
        },
        "skip": {
            "$numberLong": "5325106"
        }
    },
    "queryHash": "8880B5AF",
    "planningTimeMicros": 84,
    "protocol": "op_msg",
    "keysExamined": 0,
    "planCacheKey": "8880B5AF",
    "numYield": 5325,
    "readConcern": {
        "provenance": "implicitDefault",
        "level": "local"
    },
    "replRole": {
        "stateStr": "PRIMARY",
        "_id": 4
    },
    "docsExamined": 5325206,
    "cpuNanos": {
        "$numberLong": "2204196518"
    },
    "queryFramework": "classic",
    "cursorExhausted": true,
    "millis": 2210
}
```
从你提供的MongoDB查询日志来看，这是一个效率极低的查询操作，存在明显的性能问题。以下是关键信息解析和优化建议：


### **日志关键信息解析**
1. **查询操作详情**  
   - `op: "query"`：这是一个查询操作
   - `ns: "spider.spiderIntermediateTable"`：操作的集合是`spider`库中的`spiderIntermediateTable`
   - `nreturned: 100`：实际返回了100条文档
   - `millis: 2210`：查询耗时2.2秒
   - `docsExamined: 5325206`：扫描了超过532万条文档才返回100条结果，效率极差

2. **核心问题**  
   - `planSummary: "COLLSCAN"`：查询使用了全表扫描，未使用任何索引
   - `filter: {}`：查询没有任何过滤条件，本质上是"全表扫描+分页"
   - `skip: 5325106` + `limit: 100`：跳过532万条后取100条，这是分页查询的典型错误用法


### **性能问题根源**
1. **全表扫描（COLLSCAN）**  
   由于没有查询条件（`filter: {}`），MongoDB不得不扫描集合中所有文档，导致大量IO和CPU消耗（`bytesRead`高达146MB，`cpuNanos`达22亿纳秒）。

2. **大偏移量分页（skip过大）**  
   使用`skip: 5325106`是非常低效的做法：MongoDB需要先扫描并跳过前面的532万条文档，才能返回后面的100条。随着`skip`值增大，性能会急剧下降。

3. **锁竞争**  
   `locks`中读锁（`r`）的`acquireCount`达5327次，且`numYield: 5325`（查询被中断并重新执行5325次），说明查询长时间占用资源，影响了其他操作。


### **优化方案**

#### 1. **避免大偏移量分页（关键优化）**
**问题**：`skip`本质是"跳过前N条"，需要遍历到第N条才能开始取数据，偏移量越大越慢。  
**解决方案**：改用**基于条件的游标分页**（Cursor-based Pagination），利用索引字段定位分页起点：

```java
// 错误示例：使用skip+limit（大偏移量时性能差）
Query query = new Query();
query.skip(5325106).limit(100); // 低效！

// 优化示例：使用索引字段（如_id或时间戳）分页
// 假设上一页最后一条文档的_id是lastId
Query query = Query.query(Criteria.where("_id").gt(lastId)).limit(100);
```

**优势**：  
- 利用`_id`的天然索引（或其他有序索引）直接定位起点，无需扫描前面的文档  
- 性能稳定，不受分页深度影响


#### 2. **添加必要的查询条件**
如果业务上确实需要全表遍历（不推荐），至少要：  
- 为排序字段添加索引（如果有排序）  
- 限制单次扫描的数据量  

如果实际业务需要筛选数据，务必添加`filter`条件并为条件字段创建索引，例如：
```java
// 假设业务需要查询状态为有效的数据
Query query = Query.query(Criteria.where("isValid").is(1))
                   .limit(100);
// 为查询字段创建索引
mongoTemplate.getCollection("spiderIntermediateTable")
             .createIndex(new Document("isValid", 1));
```


#### 3. **其他优化措施**
- **使用投影（Projection）限制返回字段**：只返回必要字段，减少数据传输量  
  ```java
  query.fields().include("field1").include("field2"); // 只返回需要的字段
  ```

- **避免全表扫描的业务设计**：如果频繁需要遍历全表，可能是数据模型不合理，考虑：  
  - 按时间或类别分表存储  
  - 对历史数据进行归档  
  - 使用MongoDB分片集群分散数据量  


### **总结**
当前查询的最大问题是**大偏移量分页+全表扫描**的组合，这在大数据量集合上几乎必然导致性能问题。最有效的优化是**改用基于索引字段的游标分页**，彻底避免`skip`的大偏移量用法。如果业务允许，添加合理的查询条件并创建索引，可进一步提升性能。

## MongoDB 查询日志-修改语句 分析优化
```
{
    "op": "update",
    "ns": "spider.spiderIntermediateTable",
    "nModified": 639,
    "planSummary": "COLLSCAN",
    "storage": {
        "data": {
            "timeReadingMicros": {
                "$numberLong": "999084"
            },
            "bytesRead": {
                "$numberLong": "410204557"
            }
        }
    },
    "locks": {
        "FeatureCompatibilityVersion": {
            "acquireCount": {
                "r": {
                    "$numberLong": "1"
                },
                "w": {
                    "$numberLong": "5753"
                }
            }
        },
        "ParallelBatchWriterMode": {
            "acquireCount": {
                "r": {
                    "$numberLong": "5753"
                }
            }
        },
        "Database": {
            "acquireCount": {
                "w": {
                    "$numberLong": "5753"
                }
            }
        },
        "Collection": {
            "acquireCount": {
                "w": {
                    "$numberLong": "5753"
                }
            }
        },
        "ReplicationStateTransition": {
            "acquireCount": {
                "w": {
                    "$numberLong": "5753"
                }
            }
        },
        "Global": {
            "acquireCount": {
                "r": {
                    "$numberLong": "1"
                },
                "w": {
                    "$numberLong": "5753"
                }
            }
        }
    },
    "flowControl": {
        "acquireCount": {
            "$numberLong": "5753"
        }
    },
    "command": {
        "q": {
            "exclusiveKey": "2~D~~XY~DCFARE~1009~~0~30~~X"
        },
        "u": {
            "$set": {
                "keyExpiareTime": "2025-10-09 12:36:23",
                "isValid": 1,
                "updateTime": "2025-10-09 12:36:23"
            }
        },
        "upsert": false,
        "multi": true
    },
    "nMatched": 849,
    "writeConflicts": 505,
    "totalOplogSlotDurationMicros": 28269,
    "keysExamined": 0,
    "numYield": 5752,
    "readConcern": {
        "provenance": "implicitDefault",
        "level": "local"
    },
    "replRole": {
        "stateStr": "PRIMARY",
        "_id": 4
    },
    "keysDeleted": 0,
    "keysInserted": 0,
    "docsExamined": 5325158,
    "cpuNanos": {
        "$numberLong": "9640578327"
    },
    "nUpserted": 0,
    "millis": 14150
}
```
从你提供的MongoDB操作日志来看，这是一个效率极低的`update`操作，存在多个严重问题，需要紧急优化。以下是具体分析和解决方案：


### **关键问题分析**
1. **全表扫描（COLLSCAN）导致性能极差**  
   - 日志中`planSummary: "COLLSCAN"`表明更新操作未使用索引，进行了全表扫描。
   - `docsExamined: 5325158`显示扫描了超过532万条文档，而实际匹配仅`nMatched: 849`，效率极低。
   - 耗时`millis: 14150`（14秒），且`cpuNanos`高达96亿纳秒，严重消耗资源。

2. **锁竞争与写冲突严重**  
   - `writeConflicts: 505`表示发生了505次写冲突，说明有大量并发更新操作竞争同一批文档。
   - 各类锁的`acquireCount`高达5753次，尤其是写锁（`w`）频繁获取，会阻塞其他操作并导致锁队列累积。

3. **更新条件字段无索引**  
   - 更新条件是`"exclusiveKey": "2~D~~XY~DCFARE~1009~~0~30~~X"`，但`exclusiveKey`字段未创建索引，导致全表扫描。


### **解决方案**

#### 1. **紧急优化：为查询字段创建索引**
这是最有效的解决方式，能彻底避免全表扫描：
```javascript
// 为exclusiveKey字段创建单字段索引
db.spiderIntermediateTable.createIndex({ "exclusiveKey": 1 });
```
- 索引创建后，查询会从全表扫描变为索引查找，`docsExamined`会大幅减少（接近`nMatched`的值）。
- 操作耗时可从秒级降至毫秒级，锁竞争和CPU消耗也会显著降低。


#### 2. **优化更新逻辑**
- **避免`multi: true`的大范围更新**：日志中`nModified: 639`表示一次更新了639条文档，若业务允许，可拆分为小批量更新（如每次更新100条），减少单次操作的锁持有时间。
  ```java
  // Java示例：分批更新（伪代码）
  List<String> ids = ...; // 按批次获取需要更新的文档ID
  for (List<String> batch : Lists.partition(ids, 100)) {
      Query query = Query.query(Criteria.where("exclusiveKey").in(batch));
      Update update = Update.update("keyExpiareTime", ...)
                          .set("isValid", 1)
                          .set("updateTime", ...);
      mongoTemplate.updateMulti(query, update, "spiderIntermediateTable");
  }
  ```

- **减少写冲突**：若多个进程同时更新相同`exclusiveKey`的文档，可通过业务逻辑控制并发（如分布式锁），或在代码中添加重试机制处理`writeConflicts`。


#### 3. **监控与长期优化**
- **查看索引使用情况**：确认新索引是否被有效使用：
  ```javascript
  // 执行更新操作并查看执行计划
  db.spiderIntermediateTable.explain("executionStats").update(
      { "exclusiveKey": "2~D~~XY~DCFARE~1009~~0~30~~X" },
      { $set: { "keyExpiareTime": "...", "isValid": 1, "updateTime": "..." } },
      { multi: true }
  );
  ```
  检查`executionStats`中的`executionStages.inputStage.stage`是否为`IXSCAN`（索引扫描），而非`COLLSCAN`。

- **优化字段类型**：若`exclusiveKey`是字符串且长度较长，可考虑是否能通过哈希或映射缩短长度，提升索引效率。

- **清理历史数据**：表中存在532万条文档，若包含大量过期数据，可定期归档或删除，减少扫描范围。


### **总结**
当前最紧急的措施是为`exclusiveKey`创建索引，这能立竿见影地解决全表扫描问题。后续需优化更新逻辑，避免大批量操作，并通过监控确保索引被有效使用。若写冲突仍频繁，需从业务层控制并发访问。



## MongoDB 索引命中规则核心知识点文档

### 一、文档概述
本文聚焦 MongoDB 索引命中的核心规则，结合「复合索引字段顺序」「正则匹配类型」两大高频场景，拆解索引命中的底层逻辑、常见误区及优化方案，帮助开发者精准设计索引、避免无效查询。

### 二、核心知识点1：复合索引（联合索引）的命中规则
#### 1. 核心原理：复合索引的「前缀匹配」特性
MongoDB 的复合索引（多字段联合索引）基于 B 树实现，仅支持「从第一个字段开始的连续前缀匹配」，字段顺序直接决定索引是否能被命中。

##### 定义
假设创建复合索引 `{字段A: 1, 字段B: 1}`（1 表示升序），索引的有效匹配前缀为：
- 仅查询字段A（匹配前缀 A）；
- 查询字段A + 字段B（匹配完整前缀 A+B）；
- 仅查询字段B（不匹配任何前缀，无法命中）。

若索引顺序为 `{字段B: 1, 字段A: 1}`，则有效前缀为：
- 仅查询字段B（匹配前缀 B）；
- 查询字段B + 字段A（匹配完整前缀 B+A）；
- 仅查询字段A（不匹配任何前缀，无法命中）。

##### 实操验证示例
```javascript
// 场景1：创建索引 {A:1, B:1}，单独查询B
db.col.createIndex({A: 1, B: 1});
// 执行查询并分析执行计划
db.col.find({B: "xxx"}).explain("executionStats");
/* 结果：
- winningPlan.indexName = null（未命中索引）
- executionPlan.inputStage.stage = COLLSCAN（全表扫描）
*/

// 场景2：创建索引 {B:1, A:1}，单独查询B
db.col.createIndex({B: 1, A: 1});
db.col.find({B: "xxx"}).explain("executionStats");
/* 结果：
- winningPlan.indexName = "B_1_A_1"（命中索引）
- executionPlan.inputStage.stage = IXSCAN（索引扫描）
*/
```

#### 2. 特殊情况：索引覆盖（伪命中）
若查询满足「索引覆盖」条件（过滤字段 + 返回字段均包含在索引中），即使未命中查询索引，MongoDB 会遍历整个索引完成查询（避免回表），但性能远低于精准前缀匹配：
```javascript
// 索引 {A:1, B:1}，查询仅过滤B且仅返回B字段
db.col.find({B: "xxx"}, {B: 1, _id: 0}).explain("executionStats");
/* 结果：
- winningPlan.stage = PROJECTION_COVERED（覆盖索引）
- 需遍历全部索引项，数据量大时性能等价于全表扫描
*/
```

#### 3. 实操建议
- 字段顺序：将高频查询字段放在复合索引的前缀位置；
- 高频单字段查询：若需单独查询非前缀字段（如示例中的 B），建议单独创建该字段的单字段索引；
- 验证方法：始终通过 `explain("executionStats")` 验证，核心看 `winningPlan.indexName`（非 null 则命中）和 `inputStage.stage`（IXSCAN=索引扫描，COLLSCAN=全表扫描）。

### 三、核心知识点2：正则匹配的索引命中规则
#### 1. 核心原理：仅「前缀匹配正则」能命中普通索引
MongoDB 普通索引仅支持「从字符串开头锚定」的正则匹配（前缀匹配），后缀匹配、中间匹配均无法精准命中，具体规则如下：

| 正则类型       | 写法示例       | 是否命中普通索引 | 执行逻辑                     |
|----------------|----------------|------------------|------------------------------|
| 前缀匹配       | `^ABC_`        | ✅ 是            | 索引快速定位开头匹配的记录   |
| 后缀匹配       | `_DAD$`        | ❌ 否            | 全表/全索引扫描，逐条验证结尾 |
| 中间匹配       | `ABC.*DAD`     | ❌ 否            | 全表/全索引扫描，逐条验证包含 |

##### 实操验证示例（后缀匹配）
```javascript
// 创建普通索引
db.col.createIndex({flightCode: 1});
// 后缀匹配查询（目标：匹配以 _DAD 结尾的 flightCode）
db.col.find({flightCode: /_DAD$/}).explain("executionStats");
/* 结果：
- winningPlan.indexName = null（未命中）
- executionStats.totalKeysExamined = 索引总条数（遍历全部索引）
*/
```

#### 2. 后缀匹配的优化方案（按优先级排序）
##### 方案1：拆分字段（最优）
若字段格式固定（如 `前缀_后缀`，例 `ABC_DAD`），拆分字段存储，彻底规避正则：
```javascript
// 存储结构优化
{
  "flightPrefix": "ABC",  // 前缀部分
  "flightSuffix": "DAD",  // 后缀部分（需匹配的 arrCode）
  "flightCode": "ABC_DAD" // 保留原字段（可选）
}
// 创建后缀字段索引
db.col.createIndex({flightSuffix: 1});
// 查询：精准命中索引，无正则开销
db.col.find({flightSuffix: "DAD"});
```

##### 方案2：反向存储字段 + 前缀索引
将字段值反转存储，后缀匹配转为前缀匹配：
```java
// 1. 入库时反转字段（例：ABC_DAD → DAD_CBA）
String origin = "ABC_DAD";
String reversed = new StringBuilder(origin).reverse().toString();
// 存入 reversedFlightCode 字段

// 2. 创建反转字段索引
db.col.createIndex({reversedFlightCode: 1});

// 3. 查询时反转匹配串，前缀匹配
String arrCode = "DAD";
String reversedMatch = new StringBuilder("_" + arrCode).reverse().toString(); // _DAD → DAD_
db.col.find({reversedFlightCode: new BsonRegularExpression("^" + reversedMatch)});
```

##### 方案3：文本索引（仅适配多后缀/模糊场景）
```javascript
// 创建文本索引
db.col.createIndex({flightCode: "text"});
// 查询（注意：可能匹配相似值，精准度低）
db.col.find({$text: {$search: "_DAD"}});
```

#### 3. 关键说明
即使后缀匹配无法命中索引，`$` 锚定结尾的写法仍有价值：避免部分匹配（如 `_DAD` 不会匹配 `_DAD123`），保证匹配精准性，但无法解决性能问题。

### 四、通用避坑指南
1. 复合索引：避免“为了覆盖所有场景”创建冗余复合索引，优先拆分高频单字段索引；
2. 正则匹配：尽量用等值查询替代正则，必须用正则时优先前缀匹配；
3. 索引验证：任何索引设计后，都需通过 `explain` 验证命中情况，避免“想当然”；
4. 数据量感知：小数据量（万级以内）全表扫描无感知，大数据量（百万级+）需严格遵循索引规则。

### 五、总结
| 场景                | 能否命中普通索引 | 核心优化方向                     |
|---------------------|------------------|----------------------------------|
| 复合索引前缀字段查询 | ✅ 是            | 按查询频率排序索引字段           |
| 复合索引非前缀字段查询 | ❌ 否          | 单独创建单字段索引               |
| 正则前缀匹配        | ✅ 是            | 直接使用，无需优化               |
| 正则后缀/中间匹配   | ❌ 否            | 拆分字段 > 反向存储 > 文本索引   |

MongoDB 索引命中的核心是「匹配索引的存储逻辑」（B 树前缀匹配），任何脱离该逻辑的查询（如非前缀复合索引查询、后缀正则）都无法高效命中，需通过数据结构优化（拆分字段）或逻辑转换（反向存储）适配索引规则。


## SpringBoot 整合 MongoDB 的 YML 核心配置全解析

SpringBoot 对 MongoDB 提供了自动化配置（基于 `spring-boot-starter-data-mongodb`），核心配置集中在 `application.yml`/`application.properties` 中。以下从**基础连接、高级连接、读写配置、连接池、超时控制、副本集/分片集群**等维度，梳理 YML 配置的核心知识点和最佳实践。

### 一、核心依赖（前置）
首先确保引入 SpringBoot 整合 MongoDB 的 Starter（无需手动管理驱动版本，SpringBoot 已适配）：
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
    <!-- 若需指定版本，可覆盖 SpringBoot 父工程版本 -->
    <!-- <version>3.2.0</version> -->
</dependency>
<!-- 若使用 MongoDB 6.0+ 或需认证加密，可追加 -->
<dependency>
    <groupId>org.mongodb</groupId>
    <artifactId>mongodb-driver-sync</artifactId>
</dependency>
```

### 二、YML 核心配置分类与详解
#### 1. 基础连接配置（单机版）
最核心的基础配置，覆盖地址、库名、认证等核心信息：
```yaml
spring:
  data:
    mongodb:
      # 1. 最简连接方式（URI 格式，推荐）
      uri: mongodb://localhost:27017/test_db
      # 2. 拆分配置（替代 URI，二选一，URI 优先级更高）
      host: localhost       # 主机地址，默认 localhost
      port: 27017           # 端口，默认 27017
      database: test_db     # 要连接的数据库名，必填
      # 3. 认证配置（有密码时）
      username: root        # 用户名
      password: 123456      # 密码
      authentication-database: admin  # 认证库（默认 admin，需与 MongoDB 配置一致）
```
**关键说明**：
- `uri` 与 `host/port/database` 二选一，`uri` 优先级更高（推荐用 URI，配置更简洁）；
- 认证场景 URI 写法：`mongodb://root:123456@localhost:27017/test_db?authSource=admin`；
- 若 MongoDB 未开启认证，可省略 `username/password/authentication-database`。

#### 2. 超时控制配置（核心避坑点）
对应前文提到的「连接超时、套接字超时」，SpringBoot 中通过 URI 参数或拆分配置设置：
```yaml
spring:
  data:
    mongodb:
      # 方式1：URI 中携带超时参数（推荐）
      uri: mongodb://localhost:27017/test_db?connectTimeoutMS=5000&socketTimeoutMS=10000
      # 方式2：拆分配置（SpringBoot 2.4+ 支持）
      connect-timeout: 5000        # 连接超时，单位毫秒（默认 10 秒）
      socket-timeout: 10000        # 套接字超时（等待响应超时），单位毫秒（默认无超时）
```
**关键说明**：
- `connectTimeoutMS`：客户端与 MongoDB 建立 TCP 连接的超时时间，建议 3-10 秒；
- `socketTimeoutMS`：客户端等待 MongoDB 响应的超时时间，避免长耗时操作阻塞，建议 10-30 秒（长查询需调大）；
- 若使用副本集，`connectTimeoutMS` 建议不小于 10 秒（需覆盖节点发现+连接耗时）。

#### 3. 连接池配置（性能调优核心）
SpringBoot 整合的 MongoDB 驱动默认使用连接池，核心配置如下：
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/test_db
      # 连接池核心配置（SpringBoot 2.3+ 支持拆分配置，也可写在 URI 中）
      pool:
        max-size: 100              # 连接池最大连接数（默认 100，根据业务调整）
        min-size: 10               # 连接池最小空闲连接数（默认 0）
        max-wait-time: 2000        # 从连接池获取连接的等待超时，单位毫秒（默认无超时）
        max-connection-life-time: 3600000  # 连接最大存活时间，单位毫秒（1 小时，避免长期占用）
        max-connection-idle-time: 600000   # 连接最大空闲时间，单位毫秒（10 分钟）
```
**URI 写法等价配置**：
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/test_db?maxPoolSize=100&minPoolSize=10&waitQueueTimeoutMS=2000&maxConnectionLifeTimeMS=3600000&maxConnectionIdleTimeMS=600000
```
**最佳实践**：
- 最大连接数 `max-size`：按服务器 CPU 核心数调整（如 8 核设 50-100），避免连接过多导致 MongoDB 压力过大；
- `max-wait-time`：建议设置（如 2 秒），避免线程无限等待连接池；
- 存活/空闲时间：建议设置，定期回收无效连接，避免连接泄漏。

#### 4. 副本集/分片集群配置
若 MongoDB 部署为副本集或分片集群，YML 配置需适配集群地址：
```yaml
spring:
  data:
    mongodb:
      # 副本集 URI 格式：mongodb://节点1,节点2,节点3/库名?replicaSet=副本集名称
      uri: mongodb://192.168.1.10:27017,192.168.1.11:27017,192.168.1.12:27017/test_db?replicaSet=my-replica-set&connectTimeoutMS=10000&socketTimeoutMS=30000
      # 分片集群：连接 mongos 路由节点（写法同副本集，指向 mongos 地址）
      # uri: mongodb://192.168.1.20:27017,192.168.1.21:27017/test_db?connectTimeoutMS=10000
```
**关键参数**：
- `replicaSet`：指定副本集名称（必须与 MongoDB 副本集配置一致）；
- 分片集群只需连接 `mongos` 节点（路由层），无需关注底层分片；
- 建议开启 `readPreference`（读偏好）：`uri` 追加 `&readPreference=secondaryPreferred`（优先从从节点读，减轻主节点压力）。

#### 5. 读写配置（读偏好、写关注）
控制读写的优先级和确认策略，核心配置如下：
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://root:123456@localhost:27017/test_db?authSource=admin
      # 读偏好：优先从从节点读（secondaryPreferred），可选：primary（仅主节点，默认）、secondary（仅从节点）
      read-preference: secondaryPreferred
      # 写关注：确认写操作的级别，默认 ACKNOWLEDGED（主节点确认）
      write-concern:
        w: 1                # 1=主节点确认，2=主+1个从节点确认，majority=多数节点确认
        w-timeout: 5000     # 写确认超时，单位毫秒
        journal: true       # 是否等待日志写入磁盘（确保数据持久化）
```
**URI 等价写法**：
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://root:123456@localhost:27017/test_db?authSource=admin&readPreference=secondaryPreferred&w=1&wtimeoutMS=5000&journal=true
```
**场景建议**：
- 读多写少场景：`read-preference: secondaryPreferred`，分摊主节点读压力；
- 数据强一致性场景：`write-concern.w: majority`（多数节点确认），但会牺牲部分性能；
- 非核心数据：`write-concern.w: 1` 即可，兼顾性能和基本一致性。

#### 6. SSL 加密连接（生产环境必备）
若 MongoDB 开启 SSL 加密，需配置 SSL 相关参数：
```yaml
spring:
  data:
    mongodb:
      uri: mongodb://root:123456@localhost:27017/test_db?authSource=admin&ssl=true&sslInvalidHostNameAllowed=true
      # 拆分配置（SpringBoot 2.4+）
      ssl: true                      # 开启 SSL
      ssl-invalid-host-name-allowed: true  # 允许主机名不匹配（测试环境，生产禁用）
      # 生产环境：指定 SSL 证书
      ssl-certificate-key-store: classpath:mongodb.p12  # 证书路径
      ssl-certificate-key-store-password: 123456         # 证书密码
```

#### 7. 自定义配置（覆盖默认）
若需更精细的控制，可通过 `auto-index-creation` 等参数调整：
```yaml
spring:
  data:
    mongodb:
      database: test_db
      host: localhost
      port: 27017
      auto-index-creation: false  # 关闭自动创建索引（生产环境推荐，避免性能问题）
      field-naming-strategy: org.springframework.data.mapping.model.SnakeCaseFieldNamingStrategy  # 字段命名策略（驼峰转下划线）
```

### 三、核心配置优先级
SpringBoot 加载 MongoDB 配置的优先级从高到低：
1. 代码中手动配置的 `MongoClientSettings`（最高）；
2. `spring.data.mongodb.uri`（URI 中的参数覆盖拆分配置）；
3. 拆分配置（`host/port/database/pool/timeout` 等）；
4. 默认配置（驱动内置，如连接池最大 100，连接超时 10 秒）。

### 四、生产环境最佳配置示例
```yaml
spring:
  data:
    mongodb:
      # 副本集 URI（生产推荐）
      uri: mongodb://mongo-node1:27017,mongo-node2:27017,mongo-node3:27017/test_db?
        replicaSet=prod-replica-set&
        authSource=admin&
        username=prod_user&
        password=prod_pass&
        connectTimeoutMS=10000&
        socketTimeoutMS=30000&
        maxPoolSize=80&
        minPoolSize=10&
        waitQueueTimeoutMS=3000&
        maxConnectionLifeTimeMS=3600000&
        readPreference=secondaryPreferred&
        w=majority&
        wtimeoutMS=5000&
        ssl=true
      # 关闭自动索引，生产手动管理索引
      auto-index-creation: false
```

### 五、常见问题排查
1. **连接超时**：检查 `connectTimeoutMS` 是否过小，副本集需确保节点地址可通、副本集名称正确；
2. **连接池耗尽**：调大 `max-size` 或检查是否有连接泄漏（未关闭 `MongoClient`）；
3. **索引创建失败**：关闭 `auto-index-creation` 后，需手动执行 `db.collection.createIndex()`；
4. **读不到从节点数据**：确认 `readPreference` 配置正确，且从节点同步完成。

总结：SpringBoot 整合 MongoDB 的 YML 配置核心是「URI 简化配置 + 拆分配置兜底 + 连接池/超时调优」，生产环境需重点关注集群适配、连接池大小、超时控制和数据一致性配置，避免默认配置引发性能或稳定性问题。









