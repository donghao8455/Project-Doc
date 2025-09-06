## Nginx 配置中，`access_log` 指令的写法
问："access_log  logs/foreign-$ng_year-$ng_month-$ng_day-access.log access;"这个命令中，最后的access是什么意思，什么写法
末尾的 `access` 指的是**日志格式的名称**，用于指定该访问日志使用哪种预定义的日志格式输出内容。


### 具体说明：
1. **`access_log` 指令的完整语法**  
   `access_log` 的基本格式为：  
   ```nginx
   access_log  <日志文件路径>  <日志格式名称>;
   ```
   - 第一个参数是日志文件的保存路径（如 `logs/foreign-xxx-access.log`）；  
   - 第二个参数是**日志格式名称**（如这里的 `access`），表示该日志文件将按照这个格式记录请求信息。


2. **`access` 格式的含义**  
   `access` 是 Nginx 中**预定义的日志格式名称**（也可能是用户自定义的格式），用于定义日志中每条记录包含的内容（如请求时间、客户端 IP、请求方法、响应状态等）。  

   例如，预定义的 `access` 格式可能包含以下字段（具体需看配置中是否有定义）：  
   ```nginx
   # 假设在 nginx.conf 中有如下格式定义
   log_format  access  '$remote_addr - $remote_user [$time_local] "$request" '
                       '$status $body_bytes_sent "$http_referer" '
                       '"$http_user_agent" "$http_x_forwarded_for"';
   ```
   此时，`access_log` 引用 `access` 格式，日志会按上述字段格式记录内容（如：`192.168.1.1 - - [05/Sep/2025:10:00:00 +0800] "GET /index.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0"`）。


3. **默认行为**  
   如果未指定日志格式名称（如 `access_log logs/access.log;`），Nginx 会使用**默认的 `combined` 格式**，包含客户端 IP、请求时间、请求方法、状态码、用户代理等信息。  

   而这里显式指定 `access`，说明要使用名为 `access` 的自定义格式（需在配置文件中提前通过 `log_format` 指令定义）。


### 总结：
- `access` 是**日志格式的名称**，关联到通过 `log_format` 定义的具体日志字段规则；  
- 写法上属于 `access_log` 指令的标准语法，用于指定日志内容的输出格式；  
- 需确保配置文件中存在 `log_format access ...;` 的定义，否则 Nginx 会报错（可通过 `nginx -t` 验证配置）。

## nginx的log文件夹在哪里
Nginx 的日志目录默认在 /var/log/nginx/，包含 access.log 和 error.log；若为源码安装且未指定，通常在 nginx 安装目录下的 logs/ 子目录。

### 如何确认当前位置
- 直接查看：ls /var/log/nginx/ 
- 从配置中找：grep -r 'access_log\|error_log' /etc/nginx/ 

### 常见位置
- 发行版安装（apt/yum/dnf）：/var/log/nginx/ 
- 源码安装（未指定日志路径）：nginx安装目录/logs/ 

## nginx使用proxy_connect 指令实现正向代理
问："025/09/05 11:51:32 [emerg] 18565#18565: unknown directive "proxy_connect" in /etc/nginx/nginx.conf:86"启动nginx时报错

`nginx: [emerg] unknown directive "proxy_connect"` 报错的核心原因是：**当前 Nginx 未编译 `ngx_http_proxy_connect_module` 模块**，而 `proxy_connect` 是该第三方模块提供的指令，并非 Nginx 官方默认模块。


### 问题背景
`proxy_connect` 指令用于实现 **HTTPS 正向代理的 `CONNECT` 方法**（建立 SSL 隧道），但这个功能：
- 不属于 Nginx 官方默认模块，需要额外安装第三方模块 `ngx_http_proxy_connect_module`；
- 你的 Nginx 配置中在 HTTPS 代理服务（`listen 446`）里使用了 `proxy_connect`，但 Nginx 未识别该指令，因此启动失败。


### 解决方案：重新编译 Nginx 并添加模块
#### 1. 确认当前 Nginx 版本
首先查看已安装的 Nginx 版本（需下载对应版本的源码）：
```bash
nginx -v
# 输出示例：nginx version: nginx/1.21.6
```


#### 2. 下载 Nginx 源码和第三方模块
```bash
# 创建临时目录
mkdir -p /tmp/nginx && cd /tmp/nginx

# 下载对应版本的 Nginx 源码（版本需与当前安装的一致）
wget http://nginx.org/download/nginx-1.21.6.tar.gz
tar -zxvf nginx-1.21.6.tar.gz

# 下载 proxy_connect 模块
git clone https://github.com/chobits/ngx_http_proxy_connect_module.git
```


#### 3. 查看当前 Nginx 编译参数（关键）
需要保留原有编译参数，仅添加新模块：
```bash
nginx -V  # 注意是大写 V，输出包含编译参数
```
输出示例（需记录 `--prefix=...` 及其他参数）：
```
configure arguments: --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx ...（其他参数）
```


#### 4. 重新编译并安装 Nginx
```bash
# 进入 Nginx 源码目录
cd nginx-1.21.6

# 应用模块补丁（针对不同 Nginx 版本，需选择对应补丁，参考模块文档）
patch -p1 < ../ngx_http_proxy_connect_module/patch/proxy_connect_102101.patch

# 配置编译参数（复制原有参数，末尾添加模块路径）
./configure 原有编译参数 \
  --add-module=../ngx_http_proxy_connect_module

# 编译并安装（注意：make install 不会覆盖配置文件，但会更新二进制文件）
make && make install
```


#### 5. 验证配置并重启
```bash
# 验证配置是否生效
nginx -t

# 重启 Nginx
systemctl restart nginx  # 或 service nginx restart
```


### 替代方案：简化 HTTPS 代理配置（不依赖第三方模块）
如果暂时无法重新编译 Nginx，可删除 `proxy_connect` 相关指令，改用 Nginx 官方支持的 HTTPS 代理写法（适用于部分场景）：
```nginx
# HTTPS 代理配置（去掉 proxy_connect 相关指令）
server {
    resolver 223.5.5.5 223.6.6.6;
    resolver_timeout 5s;
    listen 446;

    # 移除 proxy_connect; 和 proxy_connect_allow all;

    location / {
        proxy_pass https://$host$request_uri;
        proxy_set_header Host $host;
        # 保留其他超时和缓冲配置...
    }
}
```
**注意**：这种写法对部分 HTTPS 场景支持有限（如需要建立 SSL 隧道的场景可能失效），推荐优先通过编译模块解决。


### 总结
`proxy_connect` 是第三方模块提供的指令，必须重新编译 Nginx 并集成 `ngx_http_proxy_connect_module` 才能使用。按上述步骤添加模块后，即可解决 `unknown directive "proxy_connect"` 错误。

## 安装第三方模块 ngx_http_proxy_connect_module
安装 `ngx_http_proxy_connect_module` 模块需要重新编译 Nginx（因 Nginx 模块需在编译时集成），以下是详细的分步操作指南：


### 一、准备工作
#### 1. 确认当前 Nginx 版本
必须下载与当前安装版本一致的源码（版本不一致可能导致编译失败）：
```bash
nginx -v  # 输出示例：nginx version: nginx/1.24.0
```

#### 2. 安装依赖工具
```bash
# CentOS/RHEL 系统
yum install -y gcc gcc-c++ make libtool zlib zlib-devel openssl openssl-devel pcre pcre-devel git

# Ubuntu/Debian 系统
apt update && apt install -y build-essential libtool zlib1g-dev openssl libssl-dev libpcre3 libpcre3-dev git
```


### 二、下载源码与模块
#### 1. 创建临时工作目录
```bash
mkdir -p /tmp/nginx && cd /tmp/nginx
```

#### 2. 下载对应版本的 Nginx 源码
将 `1.24.0` 替换为你的 Nginx 版本：
```bash
NGINX_VERSION=1.24.0
wget http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz
tar -zxvf nginx-${NGINX_VERSION}.tar.gz
```

#### 3. 下载 `ngx_http_proxy_connect_module` 模块
```bash
git clone https://github.com/chobits/ngx_http_proxy_connect_module.git
```


### 三、应用模块补丁（关键步骤）
该模块需要为 Nginx 打补丁（不同 Nginx 版本对应不同补丁，需按实际版本选择）：

#### 1. 查看模块补丁列表
```bash
ls ngx_http_proxy_connect_module/patch/
# 输出示例（包含不同版本的补丁）：
# proxy_connect_101504.patch  proxy_connect_102101.patch  proxy_connect_121001.patch
```

#### 2. 选择对应版本的补丁
- 补丁命名规则：`proxy_connect_<主版本><次版本><修订版本>.patch`  
  例如：Nginx 1.24.0 对应 `proxy_connect_12400.patch`（若不存在，选择最接近的低版本，如 1.21.0 可用 12100 补丁）。

#### 3. 应用补丁
```bash
# 进入 Nginx 源码目录
cd nginx-${NGINX_VERSION}

# 打补丁（替换为实际补丁文件名）
patch -p1 < ../ngx_http_proxy_connect_module/patch/proxy_connect_12400.patch
```
- 若提示 `patching file src/http/ngx_http_core_module.c` 等信息，说明补丁应用成功；
- 若提示报错，可能是补丁版本不匹配，需更换对应版本的补丁。


### 四、重新编译 Nginx（保留原有配置）
#### 1. 查看当前 Nginx 的编译参数
必须保留原有参数（否则新编译的 Nginx 会丢失原有功能）：
```bash
nginx -V  # 注意是大写 V，复制输出中的 `configure arguments:` 部分
```
输出示例：
```
configure arguments: --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx --modules-path=/usr/lib64/nginx/modules ...
```

#### 2. 配置编译参数（添加模块）
在原有参数基础上，添加 `--add-module=../ngx_http_proxy_connect_module`：
```bash
# 替换为你的原有参数，末尾添加模块路径
./configure --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx ...（其他原有参数） \
  --add-module=../ngx_http_proxy_connect_module
```

#### 3. 编译并安装
```bash
# 编译（-j 4 表示使用4核加速编译，可根据CPU核心数调整）
make -j 4

# 安装（会覆盖原有 nginx 二进制文件，但保留配置文件）
make install
```


### 五、验证安装结果
#### 1. 检查模块是否集成成功
```bash
nginx -V  # 查看编译参数中是否包含 `--add-module=../ngx_http_proxy_connect_module`
```

#### 2. 验证 Nginx 配置
```bash
nginx -t  # 若配置中使用了 `proxy_connect` 指令，此时应提示配置成功
```

#### 3. 重启 Nginx
```bash
# 停止原有 Nginx 进程
systemctl stop nginx

# 启动新编译的 Nginx
systemctl start nginx

# 确认状态
systemctl status nginx
```


### 六、常见问题解决
1. **补丁应用失败**  
   原因：补丁版本与 Nginx 版本不匹配。  
   解决：到模块 [GitHub 仓库](https://github.com/chobits/ngx_http_proxy_connect_module) 查看支持的版本，或尝试低版本补丁。

2. **编译报错“undefined reference to ...”**  
   原因：缺少依赖库（如 OpenSSL、PCRE）。  
   解决：重新安装步骤二中的依赖工具，确保 `openssl-devel`、`pcre-devel` 已安装。

3. **重启后 Nginx 无法启动**  
   原因：新编译的二进制文件权限问题。  
   解决：检查 `/usr/sbin/nginx` 权限，确保为 `root:root` 且有执行权限（`chmod +x /usr/sbin/nginx`）。


通过以上步骤，`ngx_http_proxy_connect_module` 模块将被成功集成到 Nginx 中，`proxy_connect` 等指令即可正常使用。

## 编译 Nginx 时，报./configure: error: 等错误
例如：./configure: error: the Google perftools module requires the Google perftools 

./configure: error: the HTTP XSLT module requires the libxml2/libxslt

./configure: error: the HTTP image filter module requires the GD library.

./configure: error: perl module ExtUtils::Embed is required 等等错误

解决方法如下：
主要是因为缺少依赖库，需要安装依赖库，然后重新编译安装nginx。

## Nginx 源码与 ngx_http_proxy_connect_module 模块的补丁不匹配-解决方案
报错信息：
src/http/ngx_http_core_module.c: 在函数‘ngx_http_core_find_config_phase’中:
src/http/ngx_http_core_module.c:961:22: 错误：‘NGX_HTTP_CONNECT’未声明(在此函数内第一次使用)
     if (r->method == NGX_HTTP_CONNECT) {
                      ^
src/http/ngx_http_core_module.c:961:22: 附注：每个未声明的标识符在其出现的函数内只报告一次
make[1]: *** [objs/src/http/ngx_http_core_module.o] 错误 1
make[1]: 离开目录“/tmp/nginx/nginx-1.20.1”
make: *** [build] 错误 2

这个错误的核心原因是 **Nginx 源码与 `ngx_http_proxy_connect_module` 模块的补丁不匹配**，导致编译时出现未定义的 `NGX_HTTP_CONNECT` 常量。具体来说，你可能使用了不兼容 Nginx 1.20.1 版本的补丁。


### 解决方案：使用正确的补丁版本
#### 1. 确认 Nginx 1.20.1 对应的正确补丁
Nginx 1.20.1 必须使用针对 **1.20.x 版本** 的专用补丁 `proxy_connect_102001.patch`（注意补丁名称中的版本号对应关系）。

#### 2. 重新下载模块并应用正确补丁
```bash
# 回到临时目录
cd /tmp/nginx

# 删除之前的模块目录（避免旧补丁残留）
rm -rf ngx_http_proxy_connect_module

# 重新克隆模块仓库（确保获取最新版本）
git clone https://github.com/chobits/ngx_http_proxy_connect_module.git

# 进入 Nginx 源码目录
cd nginx-1.20.1

# 清理之前的编译结果（关键步骤，避免残留文件导致错误）
make clean

# 应用 1.20.1 对应的正确补丁（务必使用此补丁）
patch -p1 < ../ngx_http_proxy_connect_module/patch/proxy_connect_102001.patch
```


### 若补丁仍报错：手动修改源码（备用方案）
如果上述步骤仍提示 `NGX_HTTP_CONNECT` 未声明，说明补丁未正确添加该常量定义，需手动修改 Nginx 源码：

1. 编辑 `src/http/ngx_http_request.h` 文件：
   ```bash
   vim src/http/ngx_http_request.h
   ```

2. 在文件中找到 HTTP 方法定义区域（类似 `typedef enum { ... } ngx_http_method_t;`），添加 `NGX_HTTP_CONNECT` 定义：
   ```c
   typedef enum {
       NGX_HTTP_UNKNOWN_METHOD = 0,
       NGX_HTTP_GET,
       NGX_HTTP_HEAD,
       NGX_HTTP_POST,
       NGX_HTTP_PUT,
       NGX_HTTP_DELETE,
       NGX_HTTP_MKCOL,
       NGX_HTTP_COPY,
       NGX_HTTP_MOVE,
       NGX_HTTP_OPTIONS,
       NGX_HTTP_PROPFIND,
       NGX_HTTP_PROPPATCH,
       NGX_HTTP_LOCK,
       NGX_HTTP_UNLOCK,
       NGX_HTTP_PATCH,
       NGX_HTTP_TRACE,
       NGX_HTTP_CONNECT  // 添加这一行（用于支持 CONNECT 方法）
   } ngx_http_method_t;
   ```

3. 保存文件后，重新编译：
   ```bash
   # 重新执行 configure（带你的所有参数）
   ./configure --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx ...（其他参数） \
     --add-module=../ngx_http_proxy_connect_module

   # 编译并安装
   make && make install
   ```


### 关键说明
- `NGX_HTTP_CONNECT` 是 `ngx_http_proxy_connect_module` 模块为支持 HTTPS 代理的 `CONNECT` 方法新增的常量，必须通过补丁或手动定义添加到 Nginx 源码中；
- 若多次尝试仍失败，建议降低 Nginx 版本（如 1.18.0，该版本与模块兼容性更稳定），或使用模块官方文档推荐的版本组合。

通过正确的补丁或手动添加常量，即可解决 `NGX_HTTP_CONNECT` 未声明的错误。



## proxy_connect_rewrite_1014.patch　和　proxy_connect_1014.patch有什么区别
`proxy_connect_rewrite_1014.patch` 和 `proxy_connect_1014.patch` 都是 `ngx_http_proxy_connect_module` 模块针对 **Nginx 1.14.x 版本** 的补丁文件，但功能不同，主要区别在于是否包含 **URL 重写（rewrite）相关的修复或增强**：


### 1. 文件名含义与功能差异
- **`proxy_connect_1014.patch`**  
  基础补丁，仅包含 Nginx 1.14.x 版本支持 `proxy_connect` 模块的核心功能（如 `CONNECT` 方法处理、SSL 隧道建立等），满足 HTTPS 正向代理的基本需求。

- **`proxy_connect_rewrite_1014.patch`**  
  扩展补丁，在基础功能之上，额外包含了 **与 URL 重写（rewrite）相关的适配代码**。当 Nginx 配置中使用 `rewrite` 指令与 `proxy_connect` 模块配合时（例如动态修改代理目标路径），需要此补丁避免冲突或错误。


### 2. 适用场景
- 若你的 Nginx 配置中 **不涉及 `rewrite` 指令与代理模块的结合**（仅用基础代理功能），使用 `proxy_connect_1014.patch` 即可。
- 若需要在代理配置中使用 `rewrite` 规则（如路径替换、动态代理目标等），必须使用 `proxy_connect_rewrite_1014.patch`，否则可能出现编译错误或功能异常（如重写后代理目标不正确）。


### 3. 选择建议
- 优先根据配置需求选择：有 `rewrite` 需求用 `rewrite` 版本，无则用基础版本。
- 若不确定，可先尝试基础补丁 `proxy_connect_1014.patch`；若编译或运行时出现与 `rewrite` 相关的错误（如重写后代理失效），再替换为 `proxy_connect_rewrite_1014.patch`。

两者均针对 Nginx 1.14.x 版本，核心区别在于对 `rewrite` 功能的支持与否。

## nginx正向代理如何，手工发送请求，简单验证配置的正确性

要手工验证 Nginx 正向代理配置的正确性，可以通过 `curl` 命令直接发送请求，模拟客户端通过代理访问目标服务。以下是针对 HTTP 和 HTTPS 代理的具体验证方法：


### 一、验证 HTTP 正向代理（以监听 447 端口为例）
假设 Nginx 配置了 HTTP 代理监听 447 端口，执行以下命令：

```bash
# 格式：curl -x 代理服务器IP:端口 目标HTTP地址
curl -x 127.0.0.1:447 http://example.com
```

#### 关键参数说明：
- `-x 127.0.0.1:447`：指定代理服务器地址（若代理在本地，用 `127.0.0.1`；若在远程，替换为实际 IP）和端口（447）。
- `http://example.com`：要访问的目标 HTTP 地址（可替换为任意 HTTP 网站，如 `http://baidu.com`）。

#### 验证成功标志：
- 命令返回目标网站的 HTML 内容（或状态码 200 相关响应）。
- 查看 Nginx 访问日志（如 `logs/http_proxy-xxxx-access.log`），能看到对应的请求记录。


### 二、验证 HTTPS 正向代理（以监听 446 端口为例）
若 Nginx 配置了 HTTPS 代理监听 446 端口，执行以下命令：

```bash
# 格式：curl -x 代理服务器IP:端口 目标HTTPS地址
curl -x 127.0.0.1:446 https://example.com
```

#### 注意事项：
- HTTPS 代理依赖 `ngx_http_proxy_connect_module` 模块，若未正确安装，可能返回 `502 Bad Gateway` 或连接超时。
- 若目标网站使用 HTTPS 且有严格的证书校验，可临时添加 `-k` 参数跳过证书验证（仅用于测试）：
  ```bash
  curl -k -x 127.0.0.1:446 https://example.com
  ```

#### 验证成功标志：
- 命令返回目标 HTTPS 网站的响应内容（如 HTML 或 JSON）。
- Nginx 的 HTTPS 代理日志（如 `logs/https_proxy-xxxx-access.log`）中出现该请求记录。


### 三、验证动态代理（/dynamicproxy/ 路径，以 HTTP 为例）
若配置了 `location ^~/dynamicproxy/` 动态代理，需通过请求头指定目标地址，命令如下：

```bash
# 格式：curl -H "proxy: 目标地址" -x 代理IP:端口 代理服务器的/dynamicproxy/路径
curl -H "proxy: http://example.com" -x 127.0.0.1:447 http://127.0.0.1:447/dynamicproxy/path
```

#### 说明：
- `-H "proxy: http://example.com"`：通过请求头 `proxy` 指定最终目标地址。
- `http://127.0.0.1:447/dynamicproxy/path`：访问代理服务器的动态代理路径，`path` 会被转发到目标地址的对应路径（即最终访问 `http://example.com/path`）。

#### 验证成功标志：
- 返回 `http://example.com/path` 的响应内容。
- 日志中可看到转发记录。


### 四、问题排查（若验证失败）
1. **连接超时**：
   - 检查代理服务器 IP 和端口是否正确（`netstat -tlnp | grep nginx` 确认 Nginx 正在监听对应端口）。
   - 确认防火墙未拦截该端口（如 `firewall-cmd --list-ports` 或 `ufw status`）。

2. **502 Bad Gateway**：
   - 检查 Nginx 错误日志（如 `logs/http_proxy-error.log`），可能是 DNS 解析失败（`resolver` 配置错误）或目标服务器不可达。
   - 验证目标地址是否可直接访问（去掉 `-x` 参数执行 `curl http://example.com` 测试）。

3. **HTTPS 代理失败**：
   - 确认 `ngx_http_proxy_connect_module` 模块已正确编译（`nginx -V` 查看模块列表）。
   - 检查配置中是否包含 `proxy_connect;` 和 `proxy_connect_allow all;`（HTTPS 代理必需）。


通过 `curl` 命令手工发送请求，能快速验证代理是否按预期转发请求，是调试 Nginx 正向代理配置的简单有效方法。
