## 分析一下spring中Bean 定义覆盖行为和循环依赖处理策略

在Spring框架中，`allow-bean-definition-overriding`和`allow-circular-references`是两个核心配置参数，分别用于控制**Bean定义覆盖行为**和**循环依赖处理策略**。它们直接影响Spring容器的Bean注册和初始化过程，理解这两个参数的作用和场景，对解决复杂项目中的Bean冲突和依赖问题至关重要。


### 一、`allow-bean-definition-overriding`：Bean定义覆盖开关
#### 1. 核心作用
控制当容器中出现**相同名称（`beanName`）的Bean定义**时，是否允许后定义的Bean覆盖先定义的Bean。

- **默认值**：  
  - Spring Boot 2.1之前：`true`（允许覆盖）  
  - Spring Boot 2.1及之后：`false`（不允许覆盖，避免意外覆盖）  
- **配置方式**：  
  在`application.properties`或`@Configuration`类中设置：  
  ```properties
  # 允许Bean定义覆盖
  spring.main.allow-bean-definition-overriding=true
  ```


#### 2. 场景示例与行为差异
假设项目中存在两个同名Bean：
```java
// 第一个Bean定义
@Bean
public UserService userService() {
    return new UserService("impl1");
}

// 第二个同名Bean定义
@Bean
public UserService userService() {  // 与上面的beanName相同（默认方法名）
    return new UserService("impl2");
}
```

- **当`allow-bean-definition-overriding=true`**：  
  后定义的Bean（`impl2`）会覆盖先定义的Bean（`impl1`），容器中最终只有`impl2`实例。

- **当`allow-bean-definition-overriding=false`**：  
  容器启动时直接抛出异常`BeanDefinitionStoreException`，提示“Bean name 'userService' is already used”，避免覆盖导致的隐蔽问题。


#### 3. 适用场景与风险
- **适用场景**：  
  - 多模块项目中，需要用自定义Bean覆盖框架默认Bean（如覆盖Spring Security的默认配置）。  
  - 动态注册Bean时，允许后续定义替换之前的临时Bean。

- **风险**：  
  - 意外覆盖：同名Bean可能来自不同模块，开发者未察觉，导致依赖注入的实例与预期不符（难以排查的逻辑错误）。  
  - 版本兼容问题：Spring Boot 2.1后默认关闭，升级项目时若存在同名Bean会直接报错，需手动处理。


### 二、`allow-circular-references`：循环依赖允许开关
#### 1. 核心作用
控制Spring容器是否允许**Bean之间的循环依赖**（如A依赖B，B依赖A），以及是否自动处理循环依赖。

- **默认值**：`true`（允许循环依赖，Spring会通过三级缓存机制自动处理）  
- **配置方式**：  
  ```properties
  # 禁用循环依赖
  spring.main.allow-circular-references=false
  ```


#### 2. 循环依赖的处理机制（当`allow-circular-references=true`时）
Spring通过**三级缓存**解决单例Bean的循环依赖（字段注入/setter注入场景）：
1. **一级缓存（singletonObjects）**：存储完全初始化的Bean。  
2. **二级缓存（earlySingletonObjects）**：存储提前暴露的Bean实例（未完成初始化）。  
3. **三级缓存（singletonFactories）**：存储Bean的工厂方法，用于提前暴露未初始化的Bean引用。

**处理流程**：  
- A创建时，先将自己的工厂方法放入三级缓存，然后注入B。  
- B创建时依赖A，从三级缓存获取A的提前暴露引用（未完全初始化），完成B的初始化并放入一级缓存。  
- A继续初始化，从一级缓存获取已完成的B实例，最终A完成初始化并放入一级缓存。


#### 3. 禁用循环依赖（`allow-circular-references=false`）的行为
- 若存在循环依赖，容器启动时直接抛出`BeanCurrentlyInCreationException`，提示“Requested bean is currently in creation: Is there an unresolvable circular reference?”。  
- **注意**：即使循环依赖可被Spring自动处理（如字段注入），禁用后也会报错，强制开发者解决循环依赖。


#### 4. 适用场景与最佳实践
- **保持默认`true`的场景**：  
  - 快速开发阶段，允许合理的循环依赖（如Service层的双向调用），避免过度设计。  
  - 老项目迁移，暂时无法重构循环依赖代码。

- **设置为`false`的场景**：  
  - 严格的代码规范要求，禁止循环依赖（循环依赖往往暗示设计缺陷，如职责不单一）。  
  - 排查依赖问题时，强制暴露隐藏的循环依赖链。

- **最佳实践**：  
  开发环境可设置为`false`，提前发现循环依赖并重构（如提取公共服务、使用`@Lazy`延迟注入）；生产环境保持默认`true`，避免因未发现的循环依赖导致启动失败。


### 三、两者的关联与对比
| 维度                | `allow-bean-definition-overriding`       | `allow-circular-references`              |
|---------------------|------------------------------------------|-------------------------------------------|
| 核心控制对象        | 同名Bean定义的覆盖行为                    | Bean之间的循环依赖关系                    |
| 默认值（Spring Boot 2.1+） | `false`（禁止覆盖）                       | `true`（允许循环依赖）                    |
| 异常场景            | 同名Bean定义时抛`BeanDefinitionStoreException` | 循环依赖时抛`BeanCurrentlyInCreationException` |
| 典型使用场景        | 覆盖框架默认Bean、动态注册Bean            | 允许临时的循环依赖，或强制禁止循环依赖    |


### 四、实战建议
1. **`allow-bean-definition-overriding`**：  
   - 尽量保持默认`false`，避免意外覆盖。若需覆盖（如自定义Starter），明确指定`beanName`并注释原因。  
   - 排查“Bean不生效”问题时，检查是否存在同名Bean被覆盖（可通过`/actuator/beans`端点查看最终注册的Bean）。

2. **`allow-circular-references`**：  
   - 开发阶段设置为`false`，用异常强制暴露循环依赖，通过重构消除（如拆分Service职责）。  
   - 若无法避免循环依赖，优先使用`@Lazy`延迟注入（如`@Autowired @Lazy private BService bService`），明确标记依赖关系。

通过合理配置这两个参数，可平衡项目的灵活性和稳定性，减少因Bean定义冲突或依赖设计问题导致的线上故障。