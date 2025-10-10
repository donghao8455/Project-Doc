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