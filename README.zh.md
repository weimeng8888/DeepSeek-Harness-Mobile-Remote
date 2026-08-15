# DeepSeek Harness 手机远程适配器

[English](README.md) | 中文

让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 在**手机**和**远程**都好用：手机响应式界面 + 局域网/公网（FRP）随时访问。

## 亮点

- 📱 **手机端 UI**：低于 768px 自动切换单栏布局——侧边栏变抽屉、详情全屏滑出，15+ 组件做了触控适配。
- 🏠 **局域网访问**：`--host 0.0.0.0` 一键开放，`/api` 信任栅栏自动放行局域网 IP。
- 🌍 **FRP 公网穿透**：有台公网服务器就能随时随地访问，教程含 Nginx + HTTPS + Basic Auth 加固。
- 🔧 **顺手修了两个非 HTTPS 的坑**：`crypto.randomUUID` 崩溃、引导声明刷新后反复弹出。

## 截图

| 桌面端 | 手机端抽屉 |
|---|---|
| ![desktop](docs/screenshots/desktop-home.png) | ![mobile](docs/screenshots/mobile-drawer.png) |

## 快速开始

```sh
# 1. 克隆本仓库和基础仓库
git clone https://github.com/weimeng8888/DeepSeek-Harness-Mobile-Remote.git
git clone https://github.com/deepseek-ai/deepseek-harness.git

# 2. 应用补丁（自动尝试 git apply，失败则用 overlay 覆盖）
cd DeepSeek-Harness-Mobile-Remote
./scripts/apply.sh ../deepseek-harness

# 3. 安装并构建
cd ../deepseek-harness
pnpm install && pnpm run build

# 4. 局域网启动（手机和电脑同一 Wi-Fi）
export DEEPSEEK_API_KEY="sk-你的key"
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700
```

启动日志会打印局域网地址，如 `dsh web: http://192.168.1.42:3700`，手机打开即可。

## FRP 公网穿透（亮点）

有公网服务器时，用 [FRP](https://github.com/fatedier/frp) 把本地 3700 端口穿透出去，随时随地访问：

```sh
# VPS 上：frps -c frps.toml      （示例配置在 frp/frps.toml）
# 本地：  frpc -c frpc.toml      （示例配置在 frp/frpc.toml）
# 启动 dsh 时授权公网域名：
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700 \
  --trusted-host dsh.example.com
```

⚠️ **必须配认证**：dsh 带代码执行能力，裸暴露 = 谁都能用你的机器。完整教程（Nginx + HTTPS + Basic Auth、不开放公网端口的 stcp 模式、常见问题）见 [docs/FRP-GUIDE.zh.md](docs/FRP-GUIDE.zh.md)。

## 文件结构

```
mobile-remote.patch        一键补丁（git apply）
overlay/                   修改后的完整源文件（手动覆盖用）
scripts/apply.sh           自动应用补丁
scripts/dsh-web.sh         启停脚本
frp/                       FRP 示例配置（frps/frpc/nginx）
docs/CHANGED-FILES.md      每个文件的改动说明
docs/FRP-GUIDE.zh.md       FRP 公网穿透完整教程
```

这不是装即用插件，而是源码级补丁（手机 UI 改在各包内部的 CSS Module 和组件里，外部插件无法注入）。改动基于 `deepseek-harness` commit `47f9438`。

## 许可证

MIT，与上游相同。
