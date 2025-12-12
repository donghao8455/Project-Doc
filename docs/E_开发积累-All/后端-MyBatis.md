## MyBatis-Plus 租户隔离插件核心知识点分析
MyBatis-Plus（MP）的**TenantLineInnerInterceptor（租户行拦截器）** 是实现多租户数据隔离的核心组件，其本质是通过 SQL 拦截与动态拼接，在无需手动编写租户条件的前提下，实现对多租户数据的自动隔离。以下从核心原理、核心组件、核心规则、核心场景、核心注意事项5个维度，梳理其核心知识点：

### 一、核心原理
租户隔离插件的底层是基于 MyBatis 的 `Interceptor` 接口实现的 SQL 拦截器，核心执行流程如下：
1. **拦截时机**：SQL 语句解析完成后、执行前；
2. **核心动作**：
   - 解析 SQL 语法树（依赖 JSQLParser 工具）；
   - 识别 SQL 类型（SELECT/INSERT/UPDATE/DELETE）和涉及的表；
   - 对非忽略表，自动注入「租户字段 = 当前租户ID」的条件/字段值；
   - 重构 SQL 后交给 MyBatis 执行。
3. **隔离目标**：确保不同租户的数据仅能被自身访问，实现“逻辑隔离”（区别于物理隔离：不同租户用不同库/表）。

### 二、核心组件与配置（必掌握）
#### 1. 核心拦截器：TenantLineInnerInterceptor
MP 内置的租户隔离核心插件，需注入到 MP 拦截器链中，核心参数：
| 参数/方法                | 作用                                                                 |
|--------------------------|----------------------------------------------------------------------|
| `TenantLineHandler`      | 核心处理器（必须实现），定义租户ID获取逻辑、租户字段名、忽略表规则    |
| `setDbType(DbType)`      | 指定数据库类型（如 MYSQL/ORACLE），适配不同数据库的 SQL 语法          |
| `setIgnoreUpdateById(boolean)` | 是否忽略通过 `id` 更新的语句（默认 false，即更新时仍拼接租户条件）|

#### 2. 核心接口：TenantLineHandler
租户逻辑的核心定义接口，需自定义实现，核心方法：
| 方法名                  | 作用                                                                 | 实现要点                                                                 |
|-------------------------|----------------------------------------------------------------------|--------------------------------------------------------------------------|
| `getTenantId()`         | 返回当前租户ID（Expression 类型）| 从 ThreadLocal/请求头/Token 中获取，返回 `LongValue/StringValue` 等 JSQLParser 表达式 |
| `getTenantIdColumn()`   | 指定数据库中租户字段名（如 `tenant_id`）| 需与表结构、实体类字段一致                                               |
| `ignoreTable(String)`   | 判断是否忽略当前表的租户隔离                                         | 公共表（字典/配置表）返回 true，业务表返回 false                         |
| `ignoreInsert(List)`    | （可选）忽略插入时的租户字段填充（默认 false）| 特殊场景下关闭插入时的租户字段自动填充                                   |

#### 3. 辅助组件：TenantContextHolder（租户上下文）
通常基于 `ThreadLocal` 实现，用于在多线程环境中传递租户ID，核心方法：
- `setTenantId()`：设置当前线程的租户ID；
- `getTenantId()`：获取当前线程的租户ID；
- `clear()`：清除当前线程的租户ID（避免内存泄漏）。

#### 4. 可选组件：MetaObjectHandler（字段自动填充）
用于新增数据时自动填充租户字段值，避免手动设置，核心逻辑：
```java
@Override
public void insertFill(MetaObject metaObject) {
    strictInsertFill(metaObject, "tenantId", Long.class, TenantContextHolder.getTenantId());
}
```

### 三、核心规则（SQL 拼接逻辑）
插件会根据 SQL 类型，按固定规则拼接租户ID，无需手动干预：

#### 1. SELECT 语句
- 规则：在 `WHERE` 子句末尾追加 `AND 租户字段 = 租户ID`；
- 关联查询：对所有非忽略表，均拼接租户条件（如 `a.tenant_id = 1 AND b.tenant_id = 1`）；
- 示例：
  原 SQL：`SELECT * FROM t_account WHERE account_type = '储蓄账户'`
  拼接后：`SELECT * FROM t_account WHERE account_type = '储蓄账户' AND tenant_id = 1`

#### 2. INSERT 语句
- 规则：在插入字段列表中添加租户字段，值列表中添加租户ID；
- 示例：
  原 SQL：`INSERT INTO t_account (account_no, balance) VALUES ('622208', 5000)`
  拼接后：`INSERT INTO t_account (account_no, balance, tenant_id) VALUES ('622208', 5000, 1)`

#### 3. UPDATE 语句
- 规则：在 `WHERE` 子句末尾追加 `AND 租户字段 = 租户ID`；
- 特殊：若通过 `id` 更新（如 `updateById`），默认仍拼接租户条件（可通过 `setIgnoreUpdateById(true)` 关闭）；
- 示例：
  原 SQL：`UPDATE t_account SET balance = 6000 WHERE account_no = '622208'`
  拼接后：`UPDATE t_account SET balance = 6000 WHERE account_no = '622208' AND tenant_id = 1`

#### 4. DELETE 语句
- 规则：在 `WHERE` 子句末尾追加 `AND 租户字段 = 租户ID`；
- 示例：
  原 SQL：`DELETE FROM t_account WHERE account_no = '622208'`
  拼接后：`DELETE FROM t_account WHERE account_no = '622208' AND tenant_id = 1`

### 四、核心场景与处理方式
#### 1. 基础场景：常规CRUD（自动隔离）
无需额外处理，插件自动拼接租户条件，适用于90%的业务场景（如查询/新增当前租户的账户数据）。

#### 2. 特殊场景1：忽略租户隔离（如管理员查询所有租户数据）
- 方式1：注解忽略（方法级别）
  ```java
  @InterceptorIgnore(tenantLine = "true") // 关闭当前方法的租户拦截
  public List<Account> selectAllAccounts() {
      return accountMapper.selectList(null);
  }
  ```
- 方式2：XML 手动编写 SQL（不拼接租户条件）
  ```xml
  <select id="selectAllAccounts" resultType="com.xxx.entity.Account">
      SELECT * FROM t_account
  </select>
  ```

#### 3. 特殊场景2：跨租户查询（如授权访问其他租户数据）
通过 ThreadLocal 临时切换租户ID，执行完恢复原租户：
```java
public List<Account> selectByTargetTenant(Long targetTenantId) {
    // 保存原租户ID
    Long oldTenantId = TenantContextHolder.getTenantId();
    try {
        // 临时设置目标租户ID
        TenantContextHolder.setTenantId(targetTenantId);
        // 插件自动拼接 targetTenantId 作为租户条件
        return accountMapper.selectList(Wrappers.lambdaQuery(Account.class));
    } finally {
        // 恢复原租户ID，避免影响后续操作
        TenantContextHolder.setTenantId(oldTenantId);
    }
}
```

#### 4. 特殊场景3：多表关联查询
插件会自动为所有非忽略表拼接租户条件，无需手动处理：
- 原逻辑：`JOIN t_account a ON a.id = t.account_id`
- 拼接后：`JOIN t_account a ON a.id = t.account_id AND a.tenant_id = 1 AND t.tenant_id = 1`

#### 5. 特殊场景4：异步任务传递租户ID
ThreadLocal 无法跨线程传递，需通过 `TaskDecorator` 手动传递：
```java
@Configuration
public class AsyncConfig implements AsyncConfigurer {
    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // 装饰器：传递租户上下文
        executor.setTaskDecorator(runnable -> {
            Long tenantId = TenantContextHolder.getTenantId();
            return () -> {
                try {
                    TenantContextHolder.setTenantId(tenantId);
                    runnable.run();
                } finally {
                    TenantContextHolder.clear();
                }
            };
        });
        executor.initialize();
        return executor;
    }
}
```

### 五、核心注意事项（避坑关键点）
#### 1. 表结构一致性
所有需要租户隔离的表，必须包含租户字段（如 `tenant_id`），且字段类型需与租户ID类型一致（如 BIGINT/VARCHAR）。

#### 2. 忽略表配置
公共表（如字典表、系统配置表）必须加入 `ignoreTable` 规则，否则会被拼接租户条件，导致查询不到数据。

#### 3. 索引优化
为租户字段建立索引（`CREATE INDEX idx_tenant_id ON t_account(tenant_id)`），避免因租户条件导致全表扫描，影响性能。

#### 4. 租户ID不能为空
需在 `getTenantId()` 中设置兜底值（如 0/1），避免 SQL 报错；非Web环境（定时任务）需手动设置租户ID。

#### 5. 事务与租户上下文
租户ID存储在 ThreadLocal 中，事务内的操作会继承当前线程的租户ID，无需额外处理；但事务异步回调需手动传递。

#### 6. 不支持的SQL场景
- 复杂子查询（如 `WHERE id IN (SELECT id FROM t_account)`）：插件可能无法正确拼接租户条件，需手动处理；
- 自定义 SQL 中使用 `SELECT *` 且租户字段未在实体类中定义：插入时会因缺少租户字段报错。

### 六、核心总结
| 核心维度       | 关键知识点                                                                 |
|----------------|----------------------------------------------------------------------------|
| 核心目标       | 无侵入式实现多租户逻辑隔离，避免手动编写租户条件                           |
| 核心组件       | TenantLineInnerInterceptor（拦截器）、TenantLineHandler（处理器）、ThreadLocal（上下文） |
| 核心逻辑       | 拦截SQL → 解析语法树 → 自动拼接租户字段/条件 → 重构SQL执行                 |
| 核心优势       | 低侵入、易配置、支持多场景扩展                                             |
| 核心风险点     | 表结构不一致、忽略表配置错误、异步任务上下文丢失、性能无索引               |

租户隔离插件是 MP 实现多租户的最优方案，掌握上述核心知识点，可覆盖绝大多数业务场景，同时避免常见的配置和使用坑点。
