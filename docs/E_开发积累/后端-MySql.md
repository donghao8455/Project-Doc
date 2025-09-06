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


