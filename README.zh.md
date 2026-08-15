# DeepSeek Harness 手机远程适配器

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（基于浏览器的编码智能体框架）增加**手机端响应式布局**和**局域网/远程访问**能力，让你可以在手机上通过本地网络使用它。

- **移动端 UI**：视口宽度低于 768px 时，桌面三栏布局切换为手机单栏布局。侧边栏变成划入式抽屉，详情面板变成全屏滑出层；15+ 个组件样式表增加了触控友好的尺寸、安全区域 inset 和减弱动效支持。
- **局域网/远程访问**：`dsh --profile web --host 0.0.0.0` 现在可以绑定所有网络接口（原版本会拒绝）。`/api` 浏览器信任栅栏会从绑定地址自动推导局域网 IP 字面量并接受它们；`--trusted-host` 可追加具名权威。
- **非 HTTPS 来源的 bug 修复**：`crypto.randomUUID()` 替换为 `getRandomValues()`（前者在明文 HTTP 局域网 IP 上不可用）；非回环地址的引导声明改用 `localStorage` 持久化，而非仅限 Host 的 settings namespace。

这**不是一个装即用的插件**。它是对 Harness monorepo 的一组源码级修改。本仓库提供 patch 补丁 + overlay 文件树和一个 `apply.sh` 脚本，把修改后的文件放进你的 `deepseek-harness` 检出目录。之后你构建前端并运行 `dsh --profile web --host 0.0.0.0` 即可。

## 为什么不做成插件

DeepSeek Harness 的插件是 `cordis.yml` 里挂载 npm 包的行。移动端 UI 的改动位于 UI 包**内部**——CSS Module（包私有，外部无法注入）和 React 组件逻辑（`AppFrame.tsx` 的抽屉状态机）。没有扩展点能让一个外部包覆盖另一个包的私有 CSS Module 或内部组件状态。所以正确的分发形式是源码级打补丁，而不是插件行。

远程访问的改动本身已经是插件形态（住在 `web-app` bundle 的 `startup.ts` 和 `connection` 包里）。但 `crypto`/`onboarding` 两处是核心 bug 修复，应该留在各自的包里。把它们一起打包在这里，是为了让"在手机上用 dsh"这件事在一个仓库里说清楚。

## 改了什么

| 领域 | 文件 | 内容 |
|---|---|---|
| 移动端布局核心 | `packages/client/ui-layout/src/client/AppFrame.tsx`、`columns.ts`、`AppFrame.module.css` | `MOBILE_BREAKPOINT = 768`；低于此值时侧边栏变成划入式抽屉，详情变成全屏滑出层，中栏占满视口 |
| 移动端 CSS（15 个包） | `ui-conversation`、`ui-settings-*`、`ui-primitives`、`ui-theme`、`ui-workspace`、`ui-model-selection`、`ui-sidebar`、`locale`、`ui-agent-preset` 下的 `*.module.css` | 触控友好尺寸、安全区域 inset（`env(safe-area-inset-*)`）、`[data-mobile]` 选择器、减弱动效守卫 |
| 移动端行为 | `ui-conversation` 的 `ConversationRoot.tsx`、`InputBar.tsx`、`service.ts`；`ui-layout` 的 `columns.ts`；`ui-workspace` 的 `Rows.tsx`；`ui-primitives` 的 `katex.tsx`、`MarkdownText.tsx` | 切换会话时自动关抽屉、输入栏键盘避让、KaTeX 懒加载分块（节省移动端带宽） |
| 局域网绑定 | `packages/bundle/web-app/src/startup.ts` | `--host 0.0.0.0` 不再被拒绝；帮助文本更新 |
| 信任栅栏 | `packages/client/connection/src/index.ts` | `trustedHosts`（原来是 `[]`）现在传给 `isTrustedApiRequest`——从绑定地址推导的局域网 IP 之前实际没被授权 |
| 非 HTTPS crypto | `packages/host/apiproxy/src/fetch/client.ts` | `crypto.randomUUID()` → `getRandomValues()`（手动格式化 uuidv4）；`randomUUID` 在不安全来源上不可用 |
| 非回环引导声明 | `packages/client/ui-settings-models/src/client/welcome-store.ts` | 声明版本回写 `localStorage`（不只是进程级），这样在局域网 IP 上刷新后声明保持关闭 |
| Vite / 构建 | `apps/web/vite.config.ts`、`apps/web/index.html` | KaTeX 按需分块（不进入入口 preload）；移动端 viewport meta |
| 文档与测试 | 4 个包的 README 更新；`apps/cli/reference/README.{zh,}.md`；`ui-layout`、`ui-conversation`、`ui-primitives`、`startup.spec`、`built-bin.e2e`、`welcome-store.spec` 的测试更新 | 记录新的 `--host`/非回环行为；更新断言 |

完整文件列表见 [`docs/CHANGED-FILES.md`](docs/CHANGED-FILES.md)。

## 前置条件

- [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 的检出，基线为本补丁所基于的 commit（见 `docs/CHANGED-FILES.md` 中的 commit hash）。更新的 commit 可能也能用；如果 patch 漂移了，overlay 拷贝仍然适用。
- Node.js 22.19+ 或 24+（Harness 要求）。
- pnpm（Harness workspace 使用 pnpm）。
- DeepSeek API key（或兼容的上游代理），供智能体实际运行。

## 快速开始

```sh
# 1. 克隆本适配器仓库
git clone https://github.com/weimeng8888/DeepSeek-Harness-Mobile-Remote.git
cd DeepSeek-Harness-Mobile-Remote

# 2. 克隆基础 Harness 仓库（如果还没有）
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness

# 3. 应用适配器
./scripts/apply.sh ../deepseek-harness

# 4. 安装依赖并构建
cd ../deepseek-harness
pnpm install
pnpm run build

# 5. 在局域网上为手机提供服务
export DEEPSEEK_API_KEY="sk-your-key-here"
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700
```

启动日志会打印一行 `dsh web:` 带局域网 URL。在手机上打开它（手机和电脑必须在同一个 Wi-Fi）。

用辅助脚本启动/停止/查看状态：

```sh
# 从本仓库
export DSH_REPO=/path/to/deepseek-harness
./scripts/dsh-web.sh start    # 在 0.0.0.0:3700 启动
./scripts/dsh-web.sh status
./scripts/dsh-web.sh logs
./scripts/dsh-web.sh stop
```

## 详细教程

### 第 1 步 —— 获取基础仓库

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
git checkout 47f9438   # 本补丁所基于的基线 commit（可选，但最安全）
```

如果已有检出，应用前确保工作区干净（`git stash` 或提交）。

### 第 2 步 —— 应用适配器

两种策略，都可以安全运行：

1. **`git apply`** —— `mobile-remote.patch` 原子应用，基线漂移时干净失败。
2. **overlay 拷贝** —— `overlay/` 包含每个修改文件的完整修改版。`rsync`（或 `cp -R`）把它们拷到你的目录树上。这个总是成功，即使基线漂移（它覆盖文件）。

`apply.sh` 两个都跑：先试 patch，再 overlay。重复运行是幂等的（相同内容的 overlay 拷贝是空操作）。

```sh
cd /path/to/DeepSeek-Harness-Mobile-Remote
./scripts/apply.sh /path/to/deepseek-harness
```

如果你想手动控制：

```sh
# 只打 patch
cd /path/to/deepseek-harness
git apply /path/to/DeepSeek-Harness-Mobile-Remote/mobile-remote.patch

# 或只 overlay
rsync -a /path/to/DeepSeek-Harness-Mobile-Remote/overlay/ /path/to/deepseek-harness/
```

### 第 3 步 —— 安装并构建

```sh
cd /path/to/deepseek-harness
pnpm install
pnpm run build
```

`pnpm run build` 运行 `tsc`（输出 `lib/types`）和 `tsdown`（打包运行时）。Web 前端 dist 作为 `web-app` bundle 的一部分构建。

如果你要编辑前端代码并想要热重载：

```sh
pnpm run dev:web    # 监视并重建客户端 bundle
```

### 第 4 步 —— 在局域网上提供服务

```sh
export DEEPSEEK_API_KEY="sk-your-key-here"

# 源码启动（CLI 本身不需要构建；tsx 直接运行 TypeScript）：
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700

# 或者，如果你构建了 CLI：
./node_modules/.bin/dsh --profile web --host 0.0.0.0 --port 3700
```

启动输出包含类似这样一行：

```
dsh web: http://192.168.1.42:3700
```

在手机上打开那个 URL。

### 第 5 步 ——（可选）信任自定义主机名

如果你通过主机名或域名（而非原始局域网 IP）访问 UI，用 `--trusted-host` 追加：

```sh
node --import tsx/esm apps/cli/src/bin.ts web \
  --host 0.0.0.0 --port 3700 \
  --trusted-host my-desktop.local:3700 \
  --trusted-host home.example.com
```

`/api` 信任栅栏接受：回环地址、从绑定地址推导的局域网 IP 字面量、以及任何 `--trusted-host` 条目。没有匹配的 Host，浏览器在 `/api` 上收到 403。

### 第 6 步 ——（可选）上游 LLM 代理

如果你通过本地代理（例如密钥轮换 shim）路由 DeepSeek API，在启动 `dsh web` 前设置你的 shim 需要的环境变量。辅助脚本会转发 `OPENCODE_PROXY_KEY` 和 `DEEPSEEK_BASE_URL`（如果设置了）。示例：

```sh
export DEEPSEEK_BASE_URL="http://127.0.0.1:3002/v1"
export OPENCODE_PROXY_KEY="your-proxy-key"
./scripts/dsh-web.sh start
```

## 工作原理

### 移动端断点

`columns.ts` 导出 `MOBILE_BREAKPOINT = 768`。`AppFrame.tsx` 计算 `const mobile = viewport < MOBILE_BREAKPOINT`。移动端时：

- 网格轨道折叠：`{ sidebar: 0, center: viewport, details: 0 }`。
- `.sidebarCol` 变成 `position: absolute; transform: translateX(-100%)`（划入式抽屉），由 `[data-drawer-open]` 动画滑入。
- `.detailsCol` 变成 `position: absolute; inset: 0; transform: translateX(100%)`（全屏滑出层），由 `[data-details-open]` 动画滑入。
- 一个浮动的 `.menuButton`（汉堡按钮）打开抽屉。
- 一个 `.drawerBackdrop` 遮罩会话区，点击关闭抽屉。
- 用户切换会话时抽屉自动关闭（避免关闭动画期间键盘弹出）。

高于 768px 时，桌面三栏让步链行为不变。

### 非 HTTPS 来源

浏览器在不安全（HTTP）来源上禁用 `crypto.randomUUID()`。像 `http://192.168.1.42:3700` 这样的局域网 IP 是不安全的，所以 API 代理的 `mintRpcId()` 崩溃。修复使用 `crypto.getRandomValues()`（所有浏览器都可用）并手动格式化 UUID v4。

### 信任栅栏

`connection` 包的 `apply()` 有个 bug：它调用 `isTrustedApiRequest(request, [])` 传了空数组，忽略了配置的 `trustedHosts`。修复把 `trustedHosts` 传进去，这样从 `--host 0.0.0.0` 推导的局域网 IP 才真正被授权。

## 安全须知

- **没有认证层。** `--host 0.0.0.0` 把 Web UI（及其代码执行工具）暴露给局域网上的任何人。`/api` 信任栅栏是可达性策略，不是认证。只在受信任的家庭/实验室网络上使用。
- **信任栅栏不能替代 VPN 或带认证的反向代理。** 如果需要互联网暴露，把 dsh 放在带认证的反向代理后面，不要直接用 `--host 0.0.0.0`。
- 原版 Harness 出于这个原因有意拒绝了 `--host 0.0.0.0`。本适配器重新启用了它，前提是你接受局域网暴露的风险。

## 更新

当基础 `deepseek-harness` 仓库推进时：

1. 更新检出：`git pull`（或 `git checkout <new-commit>`）。
2. 重新运行 `./scripts/apply.sh ../deepseek-harness`。如果 patch 冲突（上游移动了文件或改了逻辑），overlay 拷贝仍然应用修改后的文件，但如果上游改了同样的行，你可能需要手动解决 `AppFrame.tsx` 或 `startup.ts` 的冲突。
3. 重新构建：`pnpm run build`。

## 许可证

MIT —— 与上游 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 相同。见 [LICENSE](LICENSE)。
