## mysql如何自动执行SQL，定时、复杂逻辑等
在 MySQL 中自动执行 SQL 常用三种方式：内置事件调度器、系统定时任务（如 cron）、以及启动时执行 init-file。

---

### 方案速览
| 场景 | 怎么做 | 适用 | 注意点 |
|---|---|---|---|
| 定时执行（内置） | CREATE EVENT + SET GLOBAL event_scheduler=ON | 简单定时任务 | 需开启调度器，权限与时区要正确  |
| 系统级定时 | crontab -e 里写 mysql -e 'SQL' | 跨库、复杂脚本 | 环境变量、密码与安全  |
| 重启后执行 | my.cnf 加 init-file | 初始化/恢复 | 仅执行一次，命令要幂等  |

---

### 方案一：内置事件调度器（推荐简单定时）
- 启用调度器：
  - SET GLOBAL event_scheduler=ON; 或 SET GLOBAL event_scheduler=1;
  - 查看：SHOW VARIABLES LIKE 'event_scheduler'; 
- 常用语法（举例：每天凌晨2点备份）：
  - CREATE EVENT my_event
    ON SCHEDULE EVERY 1 DAY STARTS '2025-01-01 02:00:00'
    DO INSERT INTO backup_table SELECT * FROM original_table;
- 常见问题：
  - 重启后调度器可能关闭，在 my.cnf 中设置 event_scheduler=ON 持久化；
  - 注意时区与账号权限；
  - 若任务体有多条语句，用 DELIMITER 与 BEGIN...END 包裹。 

---

### 方案二：系统级定时（crontab）
- 示例（每天凌晨2点执行一条 SQL）：
  1) crontab -e
  2) 加入：0 2 * * * mysql -u root -p'yourpass' -D yourdb -e 'DELETE FROM old_logs WHERE created < CURDATE() - INTERVAL 30 DAY;'
- 说明：
  - 适合需要跨库、执行复杂脚本或外部命令的场景；
  - 注意环境变量、密码安全（可用 .my.cnf 免密）与错误处理；
  - 可配合日志记录执行情况。 

---

### 方案三：重启后自动执行（init-file）
- 在 my.cnf 的 [mysqld] 加入：init-file=/path/to/init.sql
- 要求：
  - 路径可被 mysqld 进程访问；
  - 语句要幂等（如 CREATE DATABASE IF NOT EXISTS...）；
  - 仅在启动时执行一次。 

---

### 选型建议
- 仅需数据库内定时：优先事件调度器，配置简单；
- 需要跨库/复杂脚本/外部命令：用 cron；
- 初始化或恢复场景：用 init-file。

## Explain工具Extra列中Using index condition、Using where
在MySQL的`EXPLAIN`工具中，`Extra`列用于提供查询执行计划的额外信息，其中`Using index condition`和`Using where`是两个常见的取值，它们反映了MySQL如何使用索引和过滤数据的细节。


### 1. `Using where`
- **含义**：表示MySQL服务器在存储引擎读取数据后，需要**进一步对数据进行过滤**（即使用`WHERE`子句中的条件过滤记录）。
- **场景**：
  - 当查询的过滤条件**不能被索引完全覆盖**时，存储引擎会先通过索引（或全表扫描）读取数据，然后由服务器层根据`WHERE`条件筛选符合要求的记录。
  - 即使使用了索引，如果索引无法直接过滤掉所有不满足条件的记录，也可能出现`Using where`。

- **示例**：
  ```sql
  -- 表t有索引 idx_a (a)
  EXPLAIN SELECT * FROM t WHERE a > 10 AND b = 20;
  ```
  - 索引`idx_a`只能用于过滤`a > 10`的记录，但`b = 20`的条件无法通过该索引过滤。
  - 存储引擎会先通过`idx_a`找到`a > 10`的记录，然后服务器层会对这些记录进一步检查`b = 20`，此时`Extra`会显示`Using where`。


### 2. `Using index condition`
- **含义**：表示MySQL使用了**索引条件下推（Index Condition Pushdown, ICP）** 优化。这是MySQL 5.6及以上版本引入的特性，允许存储引擎在读取索引时**直接过滤部分条件**，减少回表读取完整行的操作。
- **场景**：
  - 当查询使用**二级索引**（非聚簇索引），且`WHERE`条件中包含索引列的部分过滤条件时，存储引擎可以在遍历索引的同时先过滤掉不满足条件的记录，只对符合条件的记录进行回表操作。
  - 这会减少存储引擎与服务器层之间的数据传输，提升查询效率。

- **示例**：
  ```sql
  -- 表t有联合索引 idx_a_b (a, b)
  EXPLAIN SELECT * FROM t WHERE a = 10 AND b > 20;
  ```
  - 联合索引`idx_a_b`包含`a`和`b`列，存储引擎在遍历索引时，会先过滤出`a = 10`且`b > 20`的索引记录，再回表读取这些记录的完整数据。
  - 此时`Extra`会显示`Using index condition`，表示使用了ICP优化，在索引层面已完成部分过滤。


### 3. 两者的区别与联系
| 特性                | `Using where`                          | `Using index condition`                |
|---------------------|----------------------------------------|----------------------------------------|
| 过滤时机            | 服务器层（存储引擎读取数据后）          | 存储引擎层（遍历索引时）                |
| 依赖特性            | 无（所有版本支持）                     | 依赖索引条件下推（ICP）优化             |
| 适用场景            | 索引无法完全过滤条件，需二次筛选        | 二级索引场景，可在索引层面提前过滤条件  |
| 性能影响            | 可能需要回表读取大量数据后过滤，效率较低 | 减少回表数据量，效率更高                |


### 4. 常见组合情况
- **仅`Using where`**：未使用ICP，存储引擎读取数据后由服务器层过滤。
- **仅`Using index condition`**：使用ICP在索引层过滤，但仍需回表读取数据（因查询需要非索引列）。
- **`Using index condition; Using where`**：ICP过滤后，服务器层仍需进一步过滤（通常因为部分条件无法在索引层处理）。


理解这两个参数有助于判断查询是否有效利用了索引，以及是否需要通过调整索引或SQL语句来优化性能（例如，通过增加合适的索引让过滤条件尽可能在索引层完成）。

## mysql触发器

在MySQL中，触发器（Trigger）是一种与表关联的数据库对象，它会在指定事件（如INSERT、UPDATE、DELETE）发生时自动执行。下面我将介绍如何创建触发器，并提供一些示例。

### 触发器基本语法
```sql
CREATE TRIGGER trigger_name
trigger_time trigger_event
ON table_name FOR EACH ROW
trigger_body;
```

- `trigger_time`：触发时机，可为`BEFORE`或`AFTER`
- `trigger_event`：触发事件，可为`INSERT`、`UPDATE`或`DELETE`
- `FOR EACH ROW`：表示对每一行数据都执行触发器
- `trigger_body`：触发器要执行的SQL语句

### 触发器示例

以下是一个完整的示例，创建一个日志记录表和触发器，用于跟踪用户表的变更：
### 触发器使用说明

1. **特殊关键字**：
   - `NEW`：在INSERT和UPDATE触发器中使用，代表新数据
   - `OLD`：在UPDATE和DELETE触发器中使用，代表旧数据

2. **DELIMITER说明**：
   - 当触发器体包含多条SQL语句时，需要使用`DELIMITER`修改分隔符
   - 完成触发器定义后，记得将分隔符改回默认的`;`

3. **查看触发器**：
   ```sql
   SHOW TRIGGERS;
   ```

4. **删除触发器**：
   ```sql
   DROP TRIGGER IF EXISTS trigger_name;
   ```

触发器常用于数据审计、数据验证、自动维护衍生数据等场景，但应谨慎使用，过多或复杂的触发器可能会影响数据库性能。

要在MySQL中创建一个触发器，在插入数据时自动使用AES_ENCRYPT加密`name`字段，可以按照以下方式实现。这个触发器会在插入新记录前对`name`字段进行加密处理：


    
 ```sql
  -- 假设我们有一个需要加密name字段的表
CREATE TABLE example_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARBINARY(255) NOT NULL, -- 使用VARBINARY存储加密后的二进制数据
    other_column VARCHAR(100)
);

-- 创建触发器：插入前加密name字段
DELIMITER //
CREATE TRIGGER before_insert_encrypt_name
BEFORE INSERT ON example_table
FOR EACH ROW
BEGIN
    -- 使用AES_ENCRYPT加密name字段，需要提供一个密钥
    -- 注意：实际应用中应使用更安全的密钥管理方式
    SET NEW.name = AES_ENCRYPT(NEW.name, 'your_encryption_key');
END //
DELIMITER ;

-- 使用示例：插入数据时会自动加密name字段
INSERT INTO example_table (name, other_column)
VALUES ('需要加密的内容', '其他数据');

-- 查询时需要使用AES_DECRYPT解密
SELECT 
    id,
    AES_DECRYPT(name, 'your_encryption_key') AS decrypted_name,
    other_column
FROM example_table;

  ```

### 关键说明：

1. **字段类型选择**：
   - 加密后的数据是二进制的，所以`name`字段应使用`VARBINARY`或`BLOB`类型，而不是`VARCHAR`

2. **加密密钥**：
   - 示例中使用了`'your_encryption_key'`作为密钥，实际应用中应使用强密钥并妥善保管
   - 密钥丢失会导致数据无法解密，需特别注意

3. **触发器时机**：
   - 使用`BEFORE INSERT`确保在数据写入表之前完成加密操作

4. **解密查询**：
   - 查询时需要使用对应的`AES_DECRYPT`函数并提供相同的密钥才能还原数据

5. **安全性考虑**：
   - 生产环境中建议不要将密钥直接写在SQL语句中，可考虑使用变量或应用程序层面管理密钥
   - AES加密的安全性很大程度上依赖于密钥的保密性

如果需要对更新操作也进行加密处理，可以创建类似的`BEFORE UPDATE`触发器。
## 浅析Explan的rows关键词

在SQL中，`EXPLAIN`结果里的`rows`列表示MySQL估计需要扫描的行数，这个值高但实际查询速度很快的情况并不少见，是否有影响需要结合具体场景分析：


### 1. 为什么会出现“rows高但速度快”？
`rows`是优化器基于统计信息的**估计值**，并非实际扫描行数，可能存在以下原因导致“高rows但快”：
- **索引有效**：即使估计扫描行数高，但实际使用了合适的索引（如`ref`、`range`类型），数据库能快速定位到目标数据，无需全表扫描。
- **数据分布特殊**：比如查询条件过滤性极强（如`WHERE id = 1`），即使表很大（`rows`估计高），但通过主键索引能直接命中，速度极快。
- **缓存影响**：数据或索引可能已被缓存到内存中，实际IO操作很少，掩盖了“高rows”的潜在性能问题。
- **估计不准**：统计信息过时或不准确，导致`rows`估计值远高于实际需要扫描的行数。


### 2. 是否有影响？
- **短期无影响**：如果查询当前速度能满足业务需求，即使`rows`高也无需立即优化。
- **长期有隐患**：
  - 当数据量增长到一定规模，或缓存失效时，高`rows`可能导致性能骤降（比如从毫秒级变为秒级）。
  - 若`rows`估计值长期远高于实际值，可能说明统计信息不准确，会影响优化器对其他查询的执行计划选择。


### 3. 建议的操作
- **检查索引使用情况**：`EXPLAIN`中`type`列若为`const`、`eq_ref`、`ref`、`range`，说明索引有效，无需过度担心；若为`ALL`（全表扫描），即使当前快，也需优化。
- **更新统计信息**：执行`ANALYZE TABLE 表名;`更新表统计信息，让`rows`估计更准确，帮助优化器选择更好的执行计划。
- **监控性能变化**：对于核心业务查询，持续观察数据量增长后的性能趋势，避免“高rows”成为未来的性能瓶颈。


总结：`rows`高本身不是问题，但它可能是“潜在性能风险”的信号。需结合索引使用情况、实际执行时间和业务增长预期综合判断，不必为“高rows但当前快”的查询过度优化，但要警惕其长期影响。

## 批量根据主键ID修改SQL，手工拼接

在MyBatis中，如果需要手工拼接SQL实现批量根据主键ID修改，可以使用`foreach`标签来动态生成SQL语句。这种方式适用于需要根据不同ID修改对应字段值的场景。

以下是一个实现示例，假设我们要批量更新用户表的状态和最后修改时间：
````
// 对应的Mapper接口
public interface UserMapper {
    /**
     * 批量根据ID更新用户信息
     * @param userList 包含id和要更新字段的用户列表
     * @return 影响的行数
     */
    int batchUpdateById(List<User> userList);
}
    
<!-- 在Mapper.xml中定义批量更新方法 -->
<update id="batchUpdateById" parameterType="java.util.List">
    UPDATE user 
    SET 
        status = CASE 
            <!-- 循环拼接每个ID对应的状态值 -->
            <foreach collection="list" item="item" separator="">
                WHEN id = #{item.id} THEN #{item.status}
            </foreach>
        END,
        last_update_time = CASE
            <!-- 循环拼接每个ID对应的时间值 -->
            <foreach collection="list" item="item" separator="">
                WHEN id = #{item.id} THEN #{item.lastUpdateTime}
            </foreach>
        END
    <!-- 限定只更新指定ID的数据 -->
    WHERE id IN 
    <foreach collection="list" item="item" open="(" close=")" separator=",">
        #{item.id}
    </foreach>
</update>
````
### 实现说明：

1. **SQL原理**：
   - 使用`CASE WHEN`语句结合`foreach`循环，为每个ID指定对应的更新值
   - 通过`WHERE id IN`限定只更新列表中包含的ID，提高效率

2. **参数说明**：
   - `collection="list"`表示传入的参数是一个List集合
   - `item="item"`表示循环中每个元素的别名
   - `separator`指定循环元素之间的分隔符，这里为空字符串因为我们不需要额外分隔符

3. **使用场景**：
   - 适用于需要为不同ID设置不同值的批量更新场景
   - 相比多条UPDATE语句，这种方式只需一次数据库连接，性能更优

4. **注意事项**：
   - 传入的List不能为空，否则会生成无效SQL
   - 批量操作有大小限制，建议一次批量操作不超过1000条数据
   - 如果更新的字段较多，SQL语句会比较长，但性能依然优于多条单独更新
   - 需要确保所有更新的字段类型与实体类属性类型匹配

这种手工拼接的方式灵活性高，可以根据实际需求调整更新的字段和条件，是MyBatis中实现批量更新的常用方案。

## 常用 SQL 语句大全

### 一.单表查询

#### 1.基础查询
````
1.查询所有列
SELECT
FROM TableName;
2.查询特定列
SELECT Column1, Column2 FROM TableName;
3.列别名
SELECT Columni AS name1, Column2 AS name2FROM TableName;
去重查询
SELECT DISTINCT Column1 FROM TableName;
5.限制返回行数
SELECT
FROM TableName LIMIT 10;
6.分页查询
SELECT
FROM TableName LIMIT 10 OFFSET 20;
7.排序查询
SELECT
FROM TableName ORDER BY Column1 DESC;
8.多列排序
SELECT
FROM TableName ORDER BY Columni DESC, Column2 ASSC;
````

#### 2.数据过滤
````

1.
基础过滤
SELECT
<=,!=,=
FROM TableName WHERE Columni > value1;-- >,<,>=,
2.多条件过滤
SELECT
value2;
FROM TableName WHERE Columni > valuei AND OColumn2
SELECT
value2;
FROM TableName WHERE Columni > valuei OR Column2 >
3.
范围查询
SELECT
value2;
FROM TableName WHERE Columni BETWEEN value1 AND
4.IN操作符
SELECT
value3);
FROM TableName WHERE Columni IN (valuei, value2,
5.
模糊查询
SELECT
SELECT
SELECT
FROM TableName WHERE Columni LIKE '%value%:
FROM TableName WHERE Columni LIKE '%value';
FROM TableName WHERE Columni LIKE 'value%';
NULL值判断
SELECT
FROM TableName WHERE Columni IS NULL;
7.
排除特定值
SELECT
FROM TableName WHERE Column1 != value;
````



#### 3.聚合函数
````

1.计算总数
SELECT COUNT(*) AS cnt
FROM TableName
WHERE column1 = value;
2.
分组求和
SELECT columni AS col1,SUM(column2)AS col2
FROM TableName
GROUP BY column1;
分组平均值
SELECT column1 AS col1,AVG(column2)AS col2
FROM TableName
GROUP BY column1;
4.分组最大值
SELECT columni AS col1,MAX(column2)AS col2
FROM TableName
GROUP BY column1;
5.分组最小值
SELECT columni AS col1,MIN(column2)AS col2
FROM TableName
GROUP BY column1;
6.分组筛选(HAVING)
SELECT columni AS col1,SUM(column2)AS col2
FROM TableName
GROUP BY column1
WHERE column3=value
HAVING SUM(column2)>value;
多列分组
SELECT columni AS coli,columni AS col2, SUM(column3)AScol3
FROM TableName
GROUP BY column1,column2;|
````

#### 4.高级窗口函数

````

1.ROW_NUMBER生成唯一序号
SELECT column1, column2,
ROW_NUMBER() OVER (ORDER BY column2) AS row
FROM TableName;
2.RANK与DENSE_RANK排名
SELECT column1, column2,
RANK() OVER (ORDER BY column2 DESC) AS rank,
DENSE_RANK() OVER (ORDER BY column2 DESC) ASdense_rank
FROM TableName;
3.累计百分比计算
SELECT column1,column2,
SUM(column2)OVER (ORDER BY column1) / SUM(columnn2) OVER
AS cumulative_percent
FROM TableName;
4.移动平均(最近三个窗口)
SELECT column1,column2,
AVG(column2) OVER (ORDER BY columni ROWS BETTWEEN 2
PRECEDING AND CURRENT ROW) AS moving_avg
FROM TableName;
5.分组内前N名
SELECT
FROM (
SELECT column1,column2,column3,
ROW_NUMBER() OVER (PARTITION BY columni ORDERBY
column2 DESC) AS rn
FROM TableName
WHERE In <= 3;
````

### 二.多表查询

#### 1.表连接操作
````
1.内连接
SELECT t1.column1,t2.column2
FROM Table1 t1
JOIN Table2 t2
ON t1.column3 = t2.column3;
2.左连接
SELECT t1.column1,t2.column2
FROM Table1 t1
LEFTJOINTable2t2
ON t1.column3 = t2.column3;
3.右连接
SELECT t1.column1,t2.column2
FROM Table1 t1
RIGHTJOINTable2t2
ON t1.column3 = t2.column3;
4.全外连接
SELECT t1.column1.t2.column2
FROM Tablei t1
FULL OUTER JOIN Table2 t2
ON t1.column3 = t2.column3;

1.全外连接
SELECT t1.column1,t2.column2
FROM Tableiti
FULL OUTER JOIN Table2 t2
ON t1.column3 = t2.column3;
5.
自连接
SELECT ti.column as columni,t2.column as column2
FROM Tablei t1
JOIN Table1 t2
ON t1.column1=t2.column2;
6.交叉连接
SELECT
FROM Colors CROSS JOIN Sizes;


````
#### 2.子查询
````
1.标量子查询
SELECT columni,(SELECT COUNT(*) FROM TableB WHERE column2
a.column2)AScnt
FROM TableA a;
2.IN子查询
SELECT column1
FROM TableA
WHERE column2 IN (SELECT column2 FROM Categories WHERE Name
'Electronics'
3.EXISTS子查询
SELECT column1
FROM TableA a
WHERE EXISTS (SELECT 1 FROM TableB WHEREcolumn2 =
a.column2)
4.子查询作为派生表
SELECT AVG(sum) AS avg
FROM (SELECT SUM(column2) AS sum FROM TAHLEAGROUP BY
column1)AS t;
5.多条件子查询
SELECT column1, column2
FROM TableA
WHERE column2>(SELECT AVG(columm2)FROMTalbleA)
````
#### 3.联合查询
````

1.去重联合
SELECT columni FROM TableA UNION SELECT Ccolumni FROM TableB
2.不去重联合
SELECT columni FROM TableA UNION ALL SELEECT columni FROM
TableB;
````
### 三.常用函数

#### 1.字符串处理
````


1.字符串长度
SELECTLENGTH(column1) FROM TableName;
2.字符串截取
SELECT SUBSTRING(, start,length) FROM TableName;
3.字符串替换
SELECT REPLACE(columni,'old_string','new_string')FROM
TableName;
4.字符串拼接
SELECT CONCAT(column1, column2) FROM TableName;
5.字符串转大写
SELECT UPPER(column_name) FROM TableName;
6.字符串转小写
SELECT LOWER(column_name) FROM TableName
````

#### 2.时间日期函数
````

1.当前时间
SELECT CURTIME();
2.当前日期
SELECT CURDATE();
3.当前日期和时间
SELECT NOW();
4.日期向后加天数
SELECT DATE_ADD(NOW(), INTERVAL 10 DAY);
5.日期减天数
SELECT DATE_SUB(NOW(), INTERVAL 10 DAY);
6.获取两个日期插值
SELECT DATEDIFF(date1,date2);
7.获取日期年
SELECT YEAR(date)FROMTableName;
8.获取月
SELECT MONTH(date) FROM TableName;
9.获取日
SELECT DAY(date)
FROM TableName;
10.获取小时
SELECT HOUR(time)FROMTableName;
11.获取分钟
SELECT MINUTE(time) FROM TableName;
12.获取秒
SELECT SECOND(time) FROM TableName;
13.获取第几周
SELECT WEEK(time) FROM TableName;
14.日期转字符串
SELECT DATE_FORMAT(date, '%Y-%m-%d') FROMTableName;
15.字符串转日期
SELECT CAST(column AS DATE) FROM TableName;
````


### 四.常用操作
#### 1.数据操作

````
1.插入单条数据
INSERT INTO TableName (Columni, Column2) VALUES (value1,
value2);
2.插入多条数据
INSERT INTO TableName (Column1, Column2)
VALUES(value1,value2),(value3,value4);
3.更新数据
UPDATE TableName SET Columni = valuei WHERRE Column2
value2;
删除数据
DELETE FROM Orders WHERE OrderDate<'2020-01-01';
5.全表删除
DELETE FROM TempData;
6.清空表数据
TRUNCATE TABLE Logs;

````
#### 2.表操作
````
1.创建新表
CREATE TABLE TableName (
column1 INT PRIMARY KEY,
column2 VARCHAR(50),
column13 DATE
);
2.添加新列
ALTER TABLE TableName ADD COLUMN columni INT;
3.修改列类型
ALTER TABLE TableName MODIFY COLUMN columni VARCHAR(20);
4.删除列
ALTER TABLE TableName DROP COLUMN column1;
5.重命名表
ALTER TABLE TableName RENAME TO NewTab1eName:
6.删除表
DROP TABLE TableName;

````
#### 3.约束与索引
````

1.添加主键约束
ALTER TABLE TableName ADD PRIMARY KEY (column1);
2.唯一约束
ALTER TABLE TableName ADD UNIQUE (column1);
3.外键约束
ALTER TABLE TableName
ADD CONSTRAINT FK_column1
FOREIGN KEY (columni) REFERENCES TableB(column2);
创建索引
CREATE INDEX idx_columni ON TableName (column1);
5.
删除索引
DROP INDEX idx_column1 ON TableName;
6.
非空约束
ALTER TABLE TableName MODIFY COLUMN column1 VARCHAR(100) NOT
NULL;


````
#### 4.视图
````
1.创建视图
CREATE VIEW ViewName AS
SELECT column1
FROM TableName
WHERE condition;
2.
更新视图数据
UPDATEViewNameSET columni = 'value' WHEREcondition;
3.
删除视图
DROPVIEWIFEXISTSViewName;
````
#### 5.事务控制
````

1.开启事务
START TRANSACTION;
2.提交事务
COMMIT;
3.
回滚事务
ROLLBACK;
保存点
SAVEPOINT savepoint1;
5.回滚到保存点
ROLLBACK TO savepoint1;

````
#### 6.权限管理
````
1.授予查询权限
GRANT SELECT ON TableName TO user1;
2.授予所有权限
GRANT ALL PRIVILEGES ON DatabaseName." TO
'admin'@'localhost';
撤销权限
REVOKE DELETE ON TableName FROM user2;
````
#### 7.其他操作
````

1.查询所有数据库
SHOWDATABASES
2.查询所有表
SHOW TABLES
3.查询表结构
DESCRIBE TableName
4.查询建表语句
SHOW CREATE TABLE
TableName
5.查询表的所有列
SELECT COLUMN_NAME
FROMINFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'database_name' AND TAEBLE_NAME
'table_name';
6.查询表的所有索引
SHOWINDEXFROMTableName;
7.查询表大小
SELECT table_name AS 'Table',
ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 10242)AS'Size
(MB)
FROM information_schema.TABLES
WHERE table_schema = 'database_name';
8.设置时区--设置亚洲/上海时区
SET time_zone='Asia/Shanghai';
9.创建数据库
CREATE DATABASE database_name;
10.删除数据库
DROP DATABASE database_name;
````
## MySQL 字符集排序规则（Collation）核心知识点

## MySQL 字符集排序规则（Collation）核心知识点
### 1. 基础概念（是什么）
- **字符集（Charset）**：定义字符的编码方式（如 `utf8mb4` 是支持4字节UTF-8的字符集，能存储emoji等特殊字符）。
- **排序规则（Collation）**：基于字符集的**排序/比较规则**，后缀含义：
  - `_ci`：case insensitive（大小写不敏感），如 `A` 和 `a` 视为相等；
  - `_cs`：case sensitive（大小写敏感）；
  - `_bin`：二进制比较（严格按ASCII码值比较，`A`≠`a`）；
  - `_unicode_ci`：基于Unicode标准排序，精度高；
  - `_general_ci`：通用排序，速度快但精度低（早期常用，现已不推荐）。
- **层级关系**：数据库 > 表 > 字段（下层未指定时继承上层默认值）。

### 2. 排序规则不匹配的触发原因（为什么会报错）
- **核心逻辑**：MySQL 不允许在**不同排序规则**的字符串字段间直接执行等值比较（`=`）、连接（`JOIN`）、排序（`ORDER BY`）等操作。
- **常见场景**：
  1. 两张表的关联字段（如案例中 `executor_address` 和 `registry_value`）分别设置了 `utf8mb4_unicode_ci` 和 `utf8mb4_general_ci`；
  2. 手动修改某张表/字段的排序规则，但未同步关联表；
  3. 数据库默认排序规则与表/字段不一致，新建表时未显式指定。

### 3. 影响与表现（报错特征）
- **典型报错**：`Illegal mix of collations (xxx_ci,IMPLICIT) and (yyy_ci,IMPLICIT) for operation '='`；
- **影响范围**：
  - SQL 执行失败（如案例中XXL-Job的监控线程报错）；
  - 即使不报错，也可能导致索引失效（隐式转换），查询性能下降；
  - 比较结果不符合预期（如大小写判断错误）。

### 4. 解决方案（怎么解决/预防）
| 方案类型       | 具体操作                                                                 | 适用场景                     |
|----------------|--------------------------------------------------------------------------|------------------------------|
| 根源解决（推荐） | 统一关联字段/表/数据库的排序规则（优先 `utf8mb4_unicode_ci`）：<br>`ALTER TABLE 表名 MODIFY COLUMN 字段名 VARCHAR(长度) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` | 生产环境，可修改表结构       |
| 临时应急       | SQL 中显式指定排序规则：<br>`字段1 COLLATE utf8mb4_unicode_ci = 字段2 COLLATE utf8mb4_unicode_ci` | 无法修改表结构（如只读库）   |
| 提前预防       | 1. 数据库级统一默认排序规则：<br>`CREATE DATABASE 库名 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`<br>2. 新建表时显式指定排序规则 | 新项目/新建表                |

### 记忆口诀（简化核心）
```
排序规则看后缀，ci不敏bin严格；
关联比较要统一，unicode优先选；
改字段或改SQL，预防先把规则定。
```

### 总结
1. 排序规则是字符集的“比较规则”，不同规则的字段直接比较会触发MySQL报错；
2. 核心解决方案是**统一排序规则**（优先 `utf8mb4_unicode_ci`），临时方案是SQL中显式指定；
3. 最佳实践是从数据库层级统一排序规则，避免后续出现关联字段不匹配问题。

这个知识点的核心是“一致性”——只要保证参与比较/关联的字符串字段排序规则一致，就能彻底避免这类报错，记住这一点就能应对绝大多数场景。

### 方案：在 SQL 中临时指定排序规则（应急）
如果暂时无法修改表结构，可以修改 MyBatis 映射文件中的 SQL，在比较时显式指定排序规则：

```xml
<!-- 修改 XxlJobLogMapper.xml 中的 findLostJobIds 对应的 SQL -->
SELECT    
  t.id   
FROM    
  xxl_job_log_t t    
  LEFT JOIN xxl_job_registry t2 
  ON t.executor_address COLLATE utf8mb4_unicode_ci = t2.registry_value COLLATE utf8mb4_unicode_ci   
WHERE    
  t.trigger_code = 200     
  AND t.handle_code = 0     
  AND t.trigger_time   <=   ?     
  AND t2.id IS NULL;
```











