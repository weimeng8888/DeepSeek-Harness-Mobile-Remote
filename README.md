# DeepSeek Harness Mobile & Remote Adapter

English | [中文](README.zh.md)

Adds **phone-friendly responsive layout** and **LAN / remote access** to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the browser-based coding agent harness — so you can use it from a phone over your local network.

- **Mobile UI**: below 768px viewport the three-column desktop layout becomes a single-column phone layout. The sidebar is an off-canvas drawer; the details panel is a full-screen slide-over; 15+ component stylesheets add touch-friendly sizing, safe-area insets, and reduced-motion support.
- **LAN / remote access**: `dsh --profile web --host 0.0.0.0` now binds all interfaces (previously rejected). The `/api` browser-trust fence auto-derives LAN IP literals from the bind address and accepts them; `--trusted-host` adds named authorities.
- **Bug fixes for non-HTTPS origins**: `crypto.randomUUID()` replaced with `getRandomValues()` (the former is unavailable on plain-HTTP LAN IPs); non-loopback onboarding notice persists via `localStorage` instead of the Host-only settings namespace.

This is **not a plug-and-play plugin**. It is a set of source-level modifications to the Harness monorepo. The repo provides a patch + an overlay file tree and an `apply.sh` script that puts the modified files into your `deepseek-harness` checkout. After that you build the frontend and run `dsh --profile web --host 0.0.0.0`.

## Why not a plugin

DeepSeek Harness plugins are `cordis.yml` rows that mount npm packages. The mobile UI changes live **inside** UI packages — in CSS Modules (package-private, not injectable from outside) and in React component logic (`AppFrame.tsx`'s drawer state machine). There is no extension point that lets an external package override another package's private CSS Module or internal component state. So the correct distribution form is source-level patching, not a plugin row.

The remote-access changes are already plugin-shaped (they live in the `web-app` bundle's `startup.ts` and the `connection` package). But the two `crypto`/`onboarding` fixes are core bug fixes that belong in their packages. Bundling them here keeps the "run dsh on your phone" story in one place.

## What changed

| Area | Files | What |
|---|---|---|
| Mobile layout core | `packages/client/ui-layout/src/client/AppFrame.tsx`, `columns.ts`, `AppFrame.module.css` | `MOBILE_BREAKPOINT = 768`; below it the sidebar is an off-canvas drawer, details is a full-screen slide-over, center uses full viewport |
| Mobile CSS (15 packages) | `*.module.css` under `ui-conversation`, `ui-settings-*`, `ui-primitives`, `ui-theme`, `ui-workspace`, `ui-model-selection`, `ui-sidebar`, `locale`, `ui-agent-preset` | Touch-friendly sizing, safe-area insets (`env(safe-area-inset-*)`), `[data-mobile]` selectors, reduced-motion guards |
| Mobile behavior | `ui-conversation` `ConversationRoot.tsx`, `InputBar.tsx`, `service.ts`; `ui-layout` `columns.ts`; `ui-workspace` `Rows.tsx`; `ui-primitives` `katex.tsx`, `MarkdownText.tsx` | Drawer auto-closes on session switch, input-bar keyboard avoidance, lazy KaTeX chunk (mobile bandwidth) |
| LAN bind | `packages/bundle/web-app/src/startup.ts` | `--host 0.0.0.0` no longer rejected; help text updated |
| Trust fence | `packages/client/connection/src/index.ts` | `trustedHosts` (was `[]`) now passed to `isTrustedApiRequest` — LAN IPs derived from the bind were not actually authorized |
| Non-HTTPS crypto | `packages/host/apiproxy/src/fetch/client.ts` | `crypto.randomUUID()` → `getRandomValues()` (uuidv4 manual format); `randomUUID` is unavailable on insecure origins |
| Non-loopback onboarding | `packages/client/ui-settings-models/src/client/welcome-store.ts` | Notice version echoed to `localStorage` (not just process-local) so it stays dismissed across reloads on a LAN IP |
| Vite / build | `apps/web/vite.config.ts`, `apps/web/index.html` | KaTeX on-demand chunk (kept out of entry preload); viewport meta for mobile |
| Docs & tests | README updates in 4 packages; `apps/cli/reference/README.{zh,}.md`; test updates in `ui-layout`, `ui-conversation`, `ui-primitives`, `startup.spec`, `built-bin.e2e`, `welcome-store.spec` | Documented the new `--host` / non-loopback behavior; updated assertions |

Full file list: see [`docs/CHANGED-FILES.md`](docs/CHANGED-FILES.md).

## Prerequisites

- A checkout of [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) at the base commit this patch targets (see `docs/CHANGED-FILES.md` for the commit hash). Newer commits may work; if the patch drifts, the overlay copy still applies.
- Node.js 22.19+ or 24+ (per Harness requirements).
- pnpm (the Harness workspace uses pnpm).
- A DeepSeek API key (or a compatible upstream proxy) for the agent to actually run.

## Quick start

```sh
# 1. Clone this adapter repo
git clone https://github.com/weimeng8888/DeepSeek-Harness-Mobile-Remote.git
cd DeepSeek-Harness-Mobile-Remote

# 2. Clone the base Harness repo (if you don't already have it)
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness

# 3. Apply the adapter
./scripts/apply.sh ../deepseek-harness

# 4. Install dependencies and build
cd ../deepseek-harness
pnpm install
pnpm run build

# 5. Serve on the LAN for your phone
export DEEPSEEK_API_KEY="sk-your-key-here"
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700
```

The startup log prints a `dsh web:` line with the LAN URL. Open it on your phone (the phone and the computer must be on the same Wi-Fi).

For start/stop/status, use the helper script:

```sh
# From this repo
export DSH_REPO=/path/to/deepseek-harness
./scripts/dsh-web.sh start    # starts on 0.0.0.0:3700
./scripts/dsh-web.sh status
./scripts/dsh-web.sh logs
./scripts/dsh-web.sh stop
```

## Detailed tutorial

### Step 1 — Get the base repo

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
git checkout 47f9438   # the base commit this patch was built against (optional but safest)
```

If you already have a checkout, make sure your working tree is clean (`git stash` or commit) before applying.

### Step 2 — Apply the adapter

Two strategies, both safe to run:

1. **`git apply`** — the `mobile-remote.patch` applies atomically and fails cleanly if the base has drifted.
2. **overlay copy** — `overlay/` contains the full modified versions of every changed file. `rsync` (or `cp -R`) copies them over your tree. This always succeeds, even on drifted bases (it overwrites).

`apply.sh` runs both: it tries the patch first, then overlays. Re-running is idempotent (overlay copy of identical content is a no-op).

```sh
cd /path/to/DeepSeek-Harness-Mobile-Remote
./scripts/apply.sh /path/to/deepseek-harness
```

If you prefer manual control:

```sh
# Patch only
cd /path/to/deepseek-harness
git apply /path/to/DeepSeek-Harness-Mobile-Remote/mobile-remote.patch

# Or overlay only
rsync -a /path/to/DeepSeek-Harness-Mobile-Remote/overlay/ /path/to/deepseek-harness/
```

### Step 3 — Install and build

```sh
cd /path/to/deepseek-harness
pnpm install
pnpm run build
```

`pnpm run build` runs `tsc` (emits `lib/types`) and `tsdown` (bundles runtime). The web frontend dist is built as part of the `web-app` bundle.

If you will be editing frontend code and want hot-reload:

```sh
pnpm run dev:web    # watches and rebuilds client bundles
```

### Step 4 — Serve on the LAN

```sh
export DEEPSEEK_API_KEY="sk-your-key-here"

# Source launch (no build needed for the CLI itself; tsx runs TypeScript directly):
node --import tsx/esm apps/cli/src/bin.ts web --host 0.0.0.0 --port 3700

# Or, if you built the CLI:
./node_modules/.bin/dsh --profile web --host 0.0.0.0 --port 3700
```

The startup output includes a line like:

```
dsh web: http://192.168.1.42:3700
```

Open that URL on your phone.

### Step 5 — (Optional) Trust a custom hostname

If you access the UI via a hostname or domain instead of a raw LAN IP, add it with `--trusted-host`:

```sh
node --import tsx/esm apps/cli/src/bin.ts web \
  --host 0.0.0.0 --port 3700 \
  --trusted-host my-desktop.local:3700 \
  --trusted-host home.example.com
```

The `/api` trust fence accepts: loopback, LAN IP literals derived from the bind, and any `--trusted-host` entry. Without a matching Host, the browser gets 403 on `/api`.

### Step 6 — (Optional) Upstream LLM proxy

If you route the DeepSeek API through a local proxy (e.g. a key-rotation shim), set the env vars your shim expects before starting `dsh web`. The helper script forwards `OPENCODE_PROXY_KEY` and `DEEPSEEK_BASE_URL` if set. Example:

```sh
export DEEPSEEK_BASE_URL="http://127.0.0.1:3002/v1"
export OPENCODE_PROXY_KEY="your-proxy-key"
./scripts/dsh-web.sh start
```

## How it works

### Mobile breakpoint

`columns.ts` exports `MOBILE_BREAKPOINT = 768`. `AppFrame.tsx` computes `const mobile = viewport < MOBILE_BREAKPOINT`. When mobile:

- Grid tracks collapse: `{ sidebar: 0, center: viewport, details: 0 }`.
- `.sidebarCol` becomes `position: absolute; transform: translateX(-100%)` (off-canvas drawer), animated in by `[data-drawer-open]`.
- `.detailsCol` becomes `position: absolute; inset: 0; transform: translateX(100%)` (full-screen slide-over), animated in by `[data-details-open]`.
- A floating `.menuButton` (hamburger) opens the drawer.
- A `.drawerBackdrop` dims the conversation and closes the drawer on tap.
- The drawer auto-closes when the user switches sessions (avoids the keyboard popping up during the close animation).

Above 768px, the desktop three-column concession chain is unchanged.

### Non-HTTPS origins

Browsers disable `crypto.randomUUID()` on insecure (HTTP) origins. A LAN IP like `http://192.168.1.42:3700` is insecure, so the API proxy's `mintRpcId()` crashed. The fix uses `crypto.getRandomValues()` (available everywhere) and formats a UUID v4 manually.

### Trust fence

The `connection` package's `apply()` had a bug: it called `isTrustedApiRequest(request, [])` with an empty array, ignoring the configured `trustedHosts`. The fix passes `trustedHosts` so the LAN IPs derived from `--host 0.0.0.0` are actually authorized.

## Security notes

- **No authentication layer.** `--host 0.0.0.0` exposes the web UI (and its code-execution tools) to anyone on your LAN. The `/api` trust fence is a reachability policy, not authentication. Only use this on a trusted home/lab network.
- **The trust fence is not a substitute for a VPN or reverse proxy with auth.** If you need internet exposure, put dsh behind an authenticated reverse proxy and do not use `--host 0.0.0.0` directly.
- The original Harness intentionally rejected `--host 0.0.0.0` for this reason. This adapter re-enables it with the understanding that you accept the LAN-exposure risk.

## Updating

When the base `deepseek-harness` repo advances:

1. Update your checkout: `git pull` (or `git checkout <new-commit>`).
2. Re-run `./scripts/apply.sh ../deepseek-harness`. If the patch conflicts (files moved or logic changed upstream), the overlay copy still applies the modified files, but you may need to manually resolve conflicts in `AppFrame.tsx` or `startup.ts` if upstream changed the same lines.
3. Rebuild: `pnpm run build`.

## License

MIT — same as the upstream [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). See [LICENSE](LICENSE).
