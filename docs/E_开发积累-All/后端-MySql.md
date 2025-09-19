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