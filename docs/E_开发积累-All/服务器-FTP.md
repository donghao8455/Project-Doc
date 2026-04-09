# CentOS 7 搭建 FTP/SFTP 服务完整记录

> 本文档记录了在 CentOS 7 服务器上从零搭建 FTP（vsftpd）和 SFTP（基于 SSH）服务的完整过程，包括遇到的问题及解决方案。

## 一、服务器基础信息

- 操作系统：CentOS Linux 7 (Core)
- 内核：3.10.0-1160.119.1.el7.x86_64
- 架构：x86_64
- 公网 IP：47.116.36.235

## 二、搭建 FTP 服务（vsftpd）

### 2.1 安装 vsftpd

```bash
yum install -y vsftpd
rpm -qa | grep vsftpd   # 验证安装
```

### 2.2 创建 FTP 用户（ftpuser）

```bash
# 创建用户，禁止 shell 登录
useradd -d /home/ftpuser -s /sbin/nologin ftpuser

# 设置强密码（注意特殊字符用单引号）
echo 'VXEF$j!iA>KTwkHkP1F)$7to+U;x=zSdKY' | passwd --stdin ftpuser

# 创建家目录并设置权限
mkdir -p /home/ftpuser
chown ftpuser:ftpuser /home/ftpuser
chmod 750 /home/ftpuser
```

### 2.3 配置 vsftpd

编辑 `/etc/vsftpd/vsftpd.conf`：

```bash
cp /etc/vsftpd/vsftpd.conf /etc/vsftpd/vsftpd.conf.bak
vim /etc/vsftpd/vsftpd.conf
```

关键配置项：

```ini
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
chroot_local_user=YES
allow_writeable_chroot=YES          # 允许 chroot 目录可写
check_shell=NO                      # 允许使用 /sbin/nologin 的用户登录

# 被动模式端口范围
pasv_enable=YES
pasv_min_port=30000
pasv_max_port=31000
```

### 2.4 启动 vsftpd 服务

```bash
systemctl start vsftpd
systemctl enable vsftpd
systemctl status vsftpd
```

### 2.5 防火墙与 SELinux

#### 防火墙（firewalld）
如果未运行，可忽略或启用：

```bash
systemctl start firewalld
firewall-cmd --permanent --add-port=21/tcp
firewall-cmd --permanent --add-port=30000-31000/tcp
firewall-cmd --reload
```

**云服务器**：需在安全组放行 TCP 21、30000-31000 端口。

#### SELinux（已禁用）
```bash
getenforce   # 若显示 Disabled，无需配置
```

### 2.6 测试 FTP 连接

```bash
yum install -y ftp
ftp localhost
# 输入用户名 ftpuser 和密码
```

## 三、遇到的问题及解决

### 问题 1：`ftpuser` 登录提示 `This account is currently not available.`

**原因**：用户 shell 为 `/sbin/nologin`，vsftpd 默认检查 shell 有效性。

**解决**：在 `/etc/vsftpd/vsftpd.conf` 中添加 `check_shell=NO`，重启 vsftpd。

### 问题 2：本地 `ftp` 命令未找到

**解决**：安装 ftp 客户端 `yum install -y ftp`。

### 问题 3：WinSCP 使用 SFTP 连接时提示 `Received too large SFTP packet` / `无法初始化SFTP协议`

**原因**：服务器未正确配置 SFTP 子系统，或用户 shell 启动脚本输出文本。

**解决**：配置 SSH 的 SFTP 子系统（见第四部分）。

### 问题 4：修改 `/etc/ssh/sshd_config` 后 SSH 重启失败

**错误信息**：
```
/etc/ssh/sshd_config line 143: Subsystem 'sftp' already defined.
```

**原因**：`Subsystem sftp` 被定义了两次。

**解决**：
```bash
# 注释掉原有的 Subsystem 行
sed -i 's/^Subsystem sftp/#&/' /etc/ssh/sshd_config
# 添加 internal-sftp
echo "Subsystem sftp internal-sftp" >> /etc/ssh/sshd_config
sshd -t && systemctl restart sshd
```

## 四、配置 SFTP 服务（基于 SSH）

### 4.1 创建 SFTP 用户组

```bash
groupadd sftp_users
```

### 4.2 编辑 SSH 配置文件 `/etc/ssh/sshd_config`

```bash
vim /etc/ssh/sshd_config
```

确保以下配置存在（注意缩进）：

```bash
# 启用 internal-sftp 子系统
Subsystem sftp internal-sftp

# 匹配 sftp_users 组，限制用户目录
Match Group sftp_users
    ChrootDirectory /data/sftp/%u
    ForceCommand internal-sftp
    AllowTcpForwarding no
    PermitTTY no
```

**注意**：
- `Subsystem` 只能有一行未被注释。
- `Match` 块后的指令必须以空格或 Tab 缩进。

### 4.3 创建目录结构并设置权限

```bash
# 为 ftpuser 创建 chroot 目录
mkdir -p /data/sftp/ftpuser/upload
chown root:root /data/sftp/ftpuser
chmod 755 /data/sftp/ftpuser
chown ftpuser:sftp_users /data/sftp/ftpuser/upload
```

### 4.4 将 ftpuser 加入 sftp_users 组

```bash
usermod -aG sftp_users ftpuser
```

### 4.5 测试 SFTP 连接

```bash
sftp ftpuser@localhost
# 输入密码，出现 sftp> 提示符即成功
```

### 4.6 WinSCP 连接参数

- 协议：SFTP
- 主机：47.116.36.235
- 端口：22
- 用户名：ftpuser
- 密码：设置的密码

## 五、创建第二个 SFTP 用户（dft）

### 5.1 创建用户并设置密码

```bash
# 创建用户，禁止 shell 登录
useradd -m -d /home/dft -s /sbin/nologin dft

# 设置密码（密码含特殊字符，必须单引号）
echo '^SNq83HcUK^K#OQNmc4qfD6Uj#Yiv6vE' | passwd --stdin dft

# 加入 sftp_users 组
usermod -aG sftp_users dft
```

### 5.2 创建 SFTP 目录结构

```bash
mkdir -p /data/sftp/dft/upload
chown root:root /data/sftp/dft
chmod 755 /data/sftp/dft
chown dft:sftp_users /data/sftp/dft/upload
chmod 750 /data/sftp/dft/upload
```

### 5.3 测试 dft 用户

```bash
sftp dft@localhost
# 输入密码，登录后 pwd 显示 /，ls 看到 upload 目录
```

## 六、常用维护命令

### 6.1 服务管理

```bash
systemctl status vsftpd   # FTP 状态
systemctl restart vsftpd
systemctl status sshd     # SSH/SFTP 状态
systemctl restart sshd
```

### 6.2 日志查看

```bash
# vsftpd 日志
tail -f /var/log/xferlog
tail -f /var/log/secure

# SSH 日志
journalctl -u sshd -f
```

### 6.3 配置文件语法检查

```bash
sshd -t           # 检查 SSH 配置
```

### 6.4 用户与权限

```bash
# 查看用户组
id ftpuser

# 修改用户密码
passwd ftpuser

# 修改目录权限
chown -R user:group /path/to/dir
chmod 755 /path/to/dir
```

## 七、安全建议

1. **禁用 root 的 SFTP 登录**：在 `/etc/ssh/sshd_config` 中添加 `PermitRootLogin no`。
2. **使用强密码**：避免简单密码，使用特殊字符组合。
3. **限制用户目录**：始终使用 `ChrootDirectory` 将用户禁锢在自己的目录中。
4. **定期更新软件**：`yum update vsftpd openssh-server`。
5. **启用防火墙**：仅开放必要的端口（21、22、30000-31000）。
6. **考虑 FTPS 或 SFTP**：FTP 是明文传输，生产环境建议使用 SFTP 或 FTPS。

---

**文档结束**
```