# FRP 内网穿透教程

用 FRP 把本地运行的 `dsh web` 穿透到公网服务器，让你在手机上随时随地访问（不限同一 Wi-Fi）。

适用场景：你有一台带公网 IP 的云服务器（VPS），本地 Mac 跑着 dsh web；通过 FRP 把本地的 3700 端口映射到 VPS 的一个公网端口，手机访问 `http://你的域名:端口` 即可。

> ⚠️ **严重安全警告**：dsh web 是一个**带代码执行能力的智能体**。把它暴露到公网 = 任何能访问该 URL 的人都能在你机器上执行代码、读写文件。**绝不能裸暴露**。本教程要求你在 FRP 前面加一层认证（Nginx + Basic Auth + HTTPS，或 FRP 的 stcp 点对点模式）。只用 `tcp` 透传 + 无认证只适合自己临时测试，且端口用完即关。

## 架构

```
手机(任意网络)
    │  HTTPS
    ▼
┌──────────────────────────┐
│ VPS 公网服务器            │
│  Nginx(443, TLS+BasicAuth)│ ← 可选但强烈推荐
│  └─ 反代到 127.0.0.1:7001 │
│  frps(:7000 控制+ :7001)  │
└──────────────────────────┘
    ▲  TCP 隧道(frpc ↔ frps)
    │
┌──────────────────────────┐
│ 本地 Mac                  │
│  frpc → 连接 frps         │
│  dsh web :3700            │
└──────────────────────────┘
```

两条链路：
1. **frpc ↔ frps**：本地 Mac 的 frpc 主动连到 VPS 的 frps，建立 TCP 隧道。
2. **手机 → VPS → 隧道 → Mac**：手机访问 VPS 的端口，流量经隧道回到本地 dsh web。

## 前置条件

- 一台公网 VPS，开放端口（下面用 7000 做控制端口，7001 做映射端口；按你的情况改）。
- 本地 Mac 能跑 dsh web（已按主 README 装好适配器并 build）。
- （推荐）一个域名解析到 VPS，并用 certbot/Let's Encrypt 签了证书。

## 第 1 步 —— VPS 上装 frps

下载 FRP（<https://github.com/fatedier/frp/releases>），选和 VPS 架构匹配的包，解压出 `frps`。

写 `frps.toml`（VPS 上）：

```toml
# frps.toml — 服务端
bindPort = 7000

# 鉴权：frpc 必须带正确的 token 才能建隧道，防止陌生人挂隧道
auth.method = "token"
auth.token = "换成一串随机长字符串"

# 可选：dashboard，浏览器看隧道状态
webServer.addr = "127.0.0.1:7500"
webServer.user = "admin"
webServer.password = "换一个密码"
```

启动：

```sh
./frps -c frps.toml
# 建议用 systemd / supervisor 常驻
```

## 第 2 步 —— 本地 Mac 装 frpc

下载 FRP 的 darwin 包，解压出 `frpc`。

写 `frpc.toml`（本地 Mac）：

```toml
# frpc.toml — 客户端
serverAddr = "你的VPS公网IP或域名"
serverPort = 7000

auth.method = "token"
auth.token = "和 frps 里那串一致"

[[proxies]]
name = "dsh-web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3700
remotePort = 7001
```

启动 frpc：

```sh
./frpc -c frpc.toml
```

此时 VPS 的 7001 端口已映射到本地 3700。手机访问 `http://VPS公网IP:7001` 应该能看到 dsh 界面——**但 `/api` 会 403**，因为信任栅栏不认这个 Host。下一步解决。

## 第 3 步 —— 用 --trusted-host 授权公网 Host

dsh 的 `/api` 浏览器信任栅栏只接受：回环地址、从 `--host` 绑定推导的局域网 IP、以及 `--trusted-host` 声明的权威。公网域名/IP 属于第三类，必须显式声明。

```sh
# 假设你用域名 dsh.example.com 指向 VPS，VPS 的 7001 经 Nginx 反代到 443
export DEEPSEEK_API_KEY="sk-your-key"

node --import tsx/esm apps/cli/src/bin.ts web \
  --host 0.0.0.0 --port 3700 \
  --trusted-host dsh.example.com
```

- 如果直接用 `IP:7001` 访问（无域名、无 Nginx），就 `--trusted-host 你的VPS公网IP:7001`。
- `--trusted-host` 可重复，多个域名/IP 都加上。

重跑后 `/api` 不再 403，界面可用。

## 第 4 步 ——（强烈推荐）Nginx + HTTPS + Basic Auth

裸 TCP 透传到公网 = 任何人扫到端口都能用。在 VPS 上加一层 Nginx：

```nginx
# /etc/nginx/sites-available/dsh.conf
server {
    listen 443 ssl;
    server_name dsh.example.com;

    ssl_certificate     /etc/letsencrypt/live/dsh.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dsh.example.com/privkey.pem;

    # Basic Auth
    auth_basic           "dsh";
    auth_basic_user_file /etc/nginx/.htpasswd;   # htpasswd -c 生成

    # dsh 用 SSE/WebSocket 推送事件流，必须支持 upgrade 和长连接
    location / {
        proxy_pass         http://127.0.0.1:7001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400s;   # SSE 长连接，别让 Nginx 提前断
        proxy_send_timeout 86400s;
    }
}
```

生成密码文件：

```sh
sudo htpasswd -c /etc/nginx/.htpasswd 你的用户名
sudo nginx -t && sudo systemctl reload nginx
```

然后 `--trusted-host` 用域名 `dsh.example.com`（不带端口，443 是默认）。手机访问 `https://dsh.example.com`，输用户名密码，进 dsh。

**为什么 `proxy_set_header Host $host` 很重要**：信任栅栏比的是请求的 `Host` 头。Nginx 默认会把 Host 改成 `127.0.0.1:7001`（upstream 地址），那样栅栏又不认了。必须把客户端的原始 Host 透传给 dsh，配合 `--trusted-host dsh.example.com` 才能通过。

## 第 5 步 ——（更高安全）stcp 点对点，不暴露公网端口

如果不想在 VPS 开任何公网映射端口，用 FRP 的 `stcp`（secret tcp）：只有持相同 `secretKey` 的 frpc 才能访问，VPS 上不监听公网端口。

VPS `frps.toml` 同上（只需 bindPort + auth）。

本地 Mac `frpc.toml`：

```toml
serverAddr = "你的VPS公网IP"
serverPort = 7000
auth.method = "token"
auth.token = "同一串"

[[proxies]]
name = "dsh-web"
type = "stcp"
secretKey = "另一串随机字符串"   # 访问端也要带这个
localIP = "127.0.0.1"
localPort = 3700
```

手机端（或任何访问端）跑一个**第二个 frpc**：

```toml
# frpc-visitor.toml — 在手机同网段的机器上跑，或手机装 frpc
serverAddr = "你的VPS公网IP"
serverPort = 7000
auth.method = "token"
auth.token = "同一串"

[[visitors]]
name = "dsh-web-visitor"
type = "stcp"
serverName = "dsh-web"          # 对应上面的 name
secretKey = "另一串随机字符串"   # 一致
bindAddr = "127.0.0.1"
bindPort = 8080                  # 访问端本地端口
```

手机浏览器开 `http://127.0.0.1:8080`，流量经 VPS 中转回到本地 Mac 的 3700。公网完全不开映射端口，扫描器扫不到。代价：访问端必须也跑 frpc（手机上较麻烦，适合笔记本访问）。

## 常见问题

**`/api` 返回 403**
检查请求实际带的 `Host` 头（浏览器开发者工具 → Network → 任意 /api 请求 → Request Headers）。把这个 `host[:port]` 加到 `--trusted-host`。Nginx 场景确认 `proxy_set_header Host $host;` 透传了原始 Host。

**界面能开，但事件流 / 消息不更新**
dsh 用 SSE（Server-Sent Events）/ WebSocket 推送。中间任何一层（Nginx、FRP、CDN）提前断长连接都会导致这个。Nginx 加 `proxy_read_timeout 86400s`；FRP tcp 透传天然支持长连接；若用 CDN/反向代理要关掉缓冲。

**手机上 `crypto.randomUUID` 报错**
你跑的 dsh 没装本适配器（或装的是旧版）。本适配器把 `crypto.randomUUID` 换成了 `getRandomValues`，专门修了明文 HTTP 来源这个崩溃。确认已 `./scripts/apply.sh` 并 `pnpm run build`。

**FRP 连不上**
先确认 frps 的 7000 端口对 frpc 所在网络开放（VPS 安全组放行）；`auth.token` 两边一致；`serverAddr` 能解析。

## 一键启动顺序（带 Nginx 的完整链路）

```sh
# VPS
./frps -c frps.toml &          # 控制端口 7000
sudo systemctl start nginx     # 443 + BasicAuth → 127.0.0.1:7001

# 本地 Mac
./frpc -c frpc.toml &          # 连 frps，本地 3700 → VPS 7001
export DEEPSEEK_API_KEY="sk-..."
node --import tsx/esm apps/cli/src/bin.ts web \
  --host 0.0.0.0 --port 3700 \
  --trusted-host dsh.example.com
```

手机开 `https://dsh.example.com`，输用户名密码，进入 dsh。
