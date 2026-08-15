# Changed Files

Base commit: `47f943859bef60e4160492346772ded9b24f765a` (2026-08-13)

The `llm-pi-ai` package (`catalog.ts`, `config.ts`) is **excluded** — its `supportsDeveloperRole` field is a separate provider-compat feature unrelated to mobile/remote.

## Mobile UI — layout core

| Path | What |
|------|------|
| `packages/client/ui-layout/src/client/AppFrame.tsx` | Mobile drawer state machine: `MOBILE_BREAKPOINT` check, off-canvas sidebar, full-screen details slide-over, auto-close on session switch |
| `packages/client/ui-layout/src/client/columns.ts` | Added `MOBILE_BREAKPOINT = 768` export |
| `packages/client/ui-layout/src/client/AppFrame.module.css` | `[data-mobile]` selectors: drawer positioning, backdrop, menu button, safe-area insets, reduced-motion |

## Mobile UI — component stylesheets (touch-friendly)

| Path | What |
|------|------|
| `packages/client/locale/src/client/LanguageRow.module.css` | Mobile sizing |
| `packages/client/ui-agent-preset/src/client/AgentPresetSection.module.css` | Mobile sizing |
| `packages/client/ui-conversation/src/client/chat/AssistantMarkdown.module.css` | Mobile spacing |
| `packages/client/ui-conversation/src/client/chat/MessageItem.module.css` | Mobile spacing |
| `packages/client/ui-conversation/src/client/settings/EnterBehaviorRow.module.css` | Mobile sizing |
| `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css` | Mobile layout |
| `packages/client/ui-conversation/src/client/skeleton/InputBar.module.css` | Mobile input / keyboard avoidance |
| `packages/client/ui-model-selection/src/client/ModelSelect.module.css` | Mobile sizing |
| `packages/client/ui-primitives/src/markdown/MarkdownText.tsx` | Mobile markdown adjustments |
| `packages/client/ui-primitives/src/markdown/katex.tsx` | Lazy KaTeX loading (mobile bandwidth) |
| `packages/client/ui-settings-general/src/client/SettingsRoot.module.css` | Mobile settings layout |
| `packages/client/ui-settings-models/src/client/ModelsSection.module.css` | Mobile models layout |
| `packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css` | Mobile sizing |
| `packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.module.css` | Mobile sizing |
| `packages/client/ui-theme/src/client/AppearanceRow.module.css` | Mobile sizing |
| `packages/client/ui-workspace/src/client/rows/Rows.module.css` | Mobile workspace rows |

## Mobile UI — behavior (TSX)

| Path | What |
|------|------|
| `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx` | Mobile conversation root adjustments |
| `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx` | Mobile input bar |
| `packages/client/ui-conversation/src/client/service.ts` | Mobile service adjustments |
| `packages/client/ui-conversation/src/client/locales.ts` | Mobile locale string |
| `packages/client/ui-layout/src/client/AppFrame.tsx` | (see layout core above) |
| `packages/client/ui-workspace/src/client/rows/Rows.tsx` | Mobile workspace row behavior |
| `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` | Mobile sidebar adjustments |

## LAN / remote access

| Path | What |
|------|------|
| `packages/bundle/web-app/src/startup.ts` | `--host 0.0.0.0` no longer rejected; help text documents LAN bind |
| `packages/bundle/web-app/cordis.patch.yml` | Comment updates (trust fence doc) |
| `packages/client/connection/src/index.ts` | Pass `trustedHosts` (was `[]`) to `isTrustedApiRequest` |

## Non-HTTPS origin fixes

| Path | What |
|------|------|
| `packages/host/apiproxy/src/fetch/client.ts` | `crypto.randomUUID()` → `getRandomValues()` (unavailable on insecure origins) |
| `packages/client/ui-settings-models/src/client/welcome-store.ts` | Non-loopback onboarding notice persists via `localStorage` |
| `packages/client/runtime/src/client/sessions/session.ts` | Non-loopback session adjustment |

## Build config

| Path | What |
|------|------|
| `apps/web/index.html` | Mobile viewport meta (`viewport-fit=cover`) |
| `apps/web/vite.config.ts` | KaTeX on-demand chunk (kept out of entry preload) |

## Documentation

| Path | What |
|------|------|
| `apps/cli/reference/README.md` | Document `--host 0.0.0.0` LAN support |
| `apps/cli/reference/README.zh.md` | Same, Chinese |
| `packages/bundle/web-app/README.md` | Update startup doc for `--host 0.0.0.0` |
| `packages/bundle/web-app/README.zh.md` | Same, Chinese |
| `packages/client/connection/README.md` | Update trust-fence doc for LAN bind |
| `packages/client/connection/README.zh.md` | Same, Chinese |
| `packages/client/ui-settings-models/README.md` | Document localStorage onboarding persistence |
| `packages/client/ui-settings-models/README.zh.md` | Same, Chinese |

## Tests

| Path | What |
|------|------|
| `apps/cli/tests/built-bin.e2e.ts` | `--host 0.0.0.0` now exits 0 (was 1) |
| `packages/bundle/web-app/tests/startup.spec.ts` | Updated startup assertions |
| `packages/client/ui-layout/tests/app-frame.client.spec.tsx` | Mobile layout tests |
| `packages/client/ui-conversation/tests/skeleton.client.spec.tsx` | Mobile skeleton tests |
| `packages/client/ui-primitives/tests/markdown.client.spec.tsx` | Updated markdown tests |
| `packages/client/ui-primitives/tests/markdown-dom-parity.client.spec.tsx` | Updated parity tests |
| `packages/client/ui-primitives/tests/markdown-incremental.client.spec.tsx` | Updated incremental tests |
| `packages/client/ui-primitives/tests/markdown-katex-lazy.client.spec.tsx` | **New** — KaTeX lazy-load test |
| `packages/client/ui-settings-models/tests/welcome-store.client.spec.ts` | localStorage onboarding test |
