# Changelog

All notable changes to Wikso are documented in this file.

## [2.8.1] — 2026-04-27

### 🐛 Fixed

- **🪄 Setup wizard regression on upgrade** — operators upgrading from v2.6.x without the `wikso_data:/app/data` volume mount that v2.7.0 introduced were seeing the setup wizard reappear on fully-populated production instances. `SetupService` now implements `OnApplicationBootstrap`: after Prisma connects, if no `setupCompletedAt` is recorded but the DB already contains an admin user, treat the install as complete and stamp the config with that admin's `createdAt` (a meaningful audit timestamp, not "now"). Disk write is best-effort — falls back to in-memory state with a loud warning if the volume isn't mounted, so the running process behaves correctly even before the operator fixes their compose file.

### ⚠️ Upgrade note

Recommended `docker-compose.yml` mount (auto-heal works without it but won't survive container restarts):

```yaml
services:
  backend:
    volumes:
      - wikso_data:/app/data
volumes:
  wikso_data:
```

---

## [2.8.0] — 2026-04-27

> ⚠️ **Combined catch-up release.** v2.7.0 was developed but never published to GitHub — its content shipped to the public for the first time inside this v2.8.0 release. Two sections below cover both eras.

### 📚 v2.7.0 content (originally planned standalone)

#### 🤝 Collaboration suite
- **👁️ Page watching** — opt-in via Watch button; only watchers get update notifications instead of blasting every space member. New `PageWatchService` + migration + `WatchButton` UI + bell icon
- **🔗 Public shares** — generate token-scoped share links with optional password and expiry. New shares module, `/s/[token]` reader route, `ShareDialog`, `ShareViewer`
- **🔙 Backlinks** — `PageLinksService` auto-indexes internal links on save / create / restore / duplicate. New `BacklinksPanel` + `useBacklinks` hook
- **❤️ Comment reactions** — emoji reactions on comments
- **📊 Page analytics + stats dialog** — authors see engagement (views, watchers, link counts) without leaving the page

#### 🚀 Auto-migration
- **🛠️ `scripts/start.sh`** entrypoint runs `prisma migrate deploy` on every boot when `DATABASE_URL` is reachable — no more silent drift after operators forget to run migrations by hand
- **Three-mode startup** — setup (no DB) / normal (configured + reachable → migrate + boot) / degraded (configured + unreachable → boot anyway so `/admin/health` stays accessible)
- **🐳 docker-compose.yml** — removed hardcoded `DATABASE_URL` (wizard-driven now), added persistent `wikso_data` volume for config

#### 🪄 Setup wizard
- `SetupGuard` + `@SkipSetupGuard` decorator to lock post-setup endpoints before the instance is configured
- Test-DB / save-DB flow with typed DTOs; wizard persists config to `/app/data/wikso.config.json` so container restarts don't wipe it
- Prisma service exposes `isReady` flag; `HealthController.check()` returns `setup_required` when Prisma hasn't bootstrapped yet (Docker healthcheck still passes — container is up, just not configured)

#### 🎨 Admin UI — Templates redesigned
- Shared `templateStyles` tokens (category colours used in both `PageTemplatesDialog` and `/admin/templates`)
- Stats strip (TEMPLATES · SYSTEM · CUSTOM), filter chips with counts, coloured category badges
- Separated empty states (no-match vs. none), touch-friendly hover actions
- New `/admin/templates` page with create / edit / delete for custom templates

#### 🤖 AI infrastructure
- `gemini-cli` + `openai-codex` providers gain PKCE OAuth with Redis-backed state store (replaces in-memory Map that leaked across processes)
- Token rotation callback plumbed through `AIProvider` interface — rotated refresh tokens get encrypted and persisted so long-lived sessions don't log users out silently

#### 🔧 Backend infrastructure
- New `AppConfigModule` / `AppConfigService` centralises config loading (env vs. wizard file) for `PrismaService`, `RedisService`, Hocuspocus
- Notifications controller + service expanded for watcher + share notification types
- Added `pg` + `@types/pg` for direct PostgreSQL queries in the setup wizard's "Test connection" button

### 🆕 v2.8.0 batch (warm-paper + new integrations)

#### 🎨 UI / Design system
- **6 new warm-paper primitives** — `.wp-callout` (4 variants), `.wp-kbd` (paper-stamp keycap), `.wp-marginalia` (editorial margin notes), `.wp-ornament` (4 glyph variants), `.wp-ribbon` (fabric bookmark), `.wp-pullquote`
- **Appearance trigger relocated** from floating bottom-right button into the sidebar next to the user-menu; refactored panel state into `useAppearancePanel` zustand store
- **BacklinksPanel** — natural-language relative timestamps via `Intl.RelativeTimeFormat` across all 11 locales
- **Editorial dateline** on document pages — small-caps "WEEKDAY · DATE · UPDATED N AGO"
- **Dashboard empty states** refactored to `.wp-empty-card` primitive with circular accent glyph + 280px hint
- **Favorited items** in the dashboard carry a fabric ribbon-bookmark accent

#### 📊 Editor
- **Mermaid diagram blocks** — full `MermaidBlock` extension + `MermaidNodeView`
- **Callouts** redesigned in warm-paper OKLCH palette (note / tip / warn / decision); hue follows the active accent preset

#### 💬 Collaboration & AI
- **AI Chat** hook + UI (`useAiChat.ts`) for in-app conversations
- **Slack integration** — OAuth, workspace connect, channel subscriptions, events ingestion (`/api/v1/integrations/slack/*`)

#### 🤖 Developer
- **New `apps/mcp/` package** — Model Context Protocol server exposing Wikso pages as tools to Claude / other MCP clients

#### 🔒 Security
- **SSRF guard** utility (`common/utils/ssrf.ts`) with allowlist + private-IP blocking
- **`safe-zip.ts`** — zip-bomb / path-traversal protection for confluence imports

#### 🐛 Bug fixes
- **CRITICAL** — `Intl.RelativeTimeFormat('esAR')` / `('ptBR')` was throwing `RangeError`, crashing the BacklinksPanel and dateline for Argentinian and Brazilian users. Added `bcp47Locale()` normalizer + threaded through 11 callsites
- `.wp-empty` defined twice with conflicting properties — renamed inline-card variant to `.wp-empty-card`
- `.wp-marginalia` float math caused horizontal scroll on 13" laptops — bumped breakpoint 1100→1280px and tightened width 220→180px
- `CalloutExtension.renderHTML` was emitting stale `class="callout callout-info"` — aligned with `wp-callout`

#### 🌍 i18n
- 122 new strings × 11 locales (en, ru, uk, be, pl, es, esAR, pt, ptBR, zh, tr)

### ⚠️ Known regression (fixed in v2.8.1)

This release is the first time the v2.7.0 wizard-driven config flow shipped publicly. Operators upgrading from v2.6.x whose `docker-compose.yml` lacked the new `wikso_data:/app/data` volume mount saw the setup wizard reappear on fully-populated installs. **[v2.8.1](#281--2026-04-27) auto-detects and recovers** — recommended to upgrade straight there.

---

## [2.6.1] — 2026-03-29

### 🐛 Fixed
- **🗄️ Database migration** — added missing Prisma migration for `AiConfig` table that prevented AI provider setup on fresh deployments

---

## [2.6.0] — 2026-03-29

### ✨ Added

#### 🤖 AI Assistant
- **AI-powered text editor** — select text in the editor and apply AI transformations via a floating bubble menu
- **5 built-in operations** — Expand, Summarize, Fix Grammar, Change Tone, and Custom Prompt
- **💬 Custom prompts** — write free-form instructions to transform selected text however you want
- **⚡ Real-time streaming** — AI responses stream into the editor via SSE as they generate
- **🔌 7 AI providers** with two connection modes:
  - **Subscription-based (no API key needed):**
    - 🟣 Claude (Subscription) — connect via Anthropic setup token
    - 🟢 OpenAI (Subscription) — connect via ChatGPT Plus/Pro OAuth
    - 🔵 Gemini (Subscription) — connect via Google account OAuth
  - **API key-based (Beta):**
    - 🟣 Anthropic Claude — API key
    - 🟢 OpenAI — API key
    - 🔵 Google Gemini — API key
    - 🦙 Ollama — self-hosted, no credentials needed

> ⚠️ **Note:** Subscription-based providers use unofficial OAuth flows and CLI tools to access AI models through your personal subscription. These integrations are not officially supported by the AI vendors and may stop working if the vendor changes their API or terms of service. Use API key-based providers for production environments where reliability is critical. Subscription-based access may also be subject to stricter rate limits imposed by the vendor.

#### 🛠️ Admin Panel — AI Settings (`/admin/ai`)
- **📋 Provider configuration page** — cards for each provider with model selection, API key input, and connection status
- **🔗 OAuth flows** — step-by-step UI for connecting ChatGPT and Google accounts (PKCE)
- **🧪 Test Connection** — verify provider connectivity before activating
- **⭐ Set Active / Disable** — switch between providers or disable AI entirely
- **🔌 Disconnect button** — remove saved credentials and revoke provider access per provider
- **🏷️ Subscription providers prioritized** — shown first in the UI; API-key providers marked with Beta badge

#### 🔒 Security
- **🔐 Credential encryption** — all API keys and OAuth tokens encrypted at rest in the database (AES-256-GCM)
- **🧹 Minimal file exposure** — CLI auth files written only during requests and deleted immediately after
- **🛡️ Stderr sanitization** — file paths and system info stripped from error messages returned to clients
- **🚫 No hardcoded secrets** — OAuth client credentials loaded from environment variables only

#### 🌍 Internationalization
- AI menu and admin page fully translated in all 11 locales: English, Russian, Ukrainian, Belarusian, Polish, Spanish, Spanish (AR), Portuguese, Portuguese (BR), Chinese, Turkish

### 🔄 Changed
- **📝 Editor** — integrated `<AiMenu>` bubble menu component in both standard and collaborative editors
- **📌 Admin sidebar** — added AI Settings navigation link
- **🐳 Docker** — backend image now includes Codex CLI and Gemini CLI for subscription-based providers
- **📦 docker-compose.yml** — added volume mounts for CLI credential directories
- **📖 README** — added AI Assistant section, architecture diagram update, new environment variables

### ⚙️ Environment Variables (new)
| Variable | Description | Required |
|----------|-------------|----------|
| `ENCRYPTION_KEY` | Key for encrypting stored credentials (32+ chars). Falls back to `JWT_SECRET` if not set. | Recommended for production |
| `GEMINI_CLI_OAUTH_CLIENT_ID` | Google OAuth client ID for Gemini subscription flow | Only if using Gemini subscription |
| `GEMINI_CLI_OAUTH_CLIENT_SECRET` | Google OAuth client secret for Gemini subscription flow | Only if using Gemini subscription |
| `AI_MAX_TOKENS` | Maximum tokens for AI responses (default: 2048) | Optional |

### 📁 New Files
<details>
<summary>🔧 Backend (16 files)</summary>

- `apps/backend/src/ai/ai.module.ts`
- `apps/backend/src/ai/ai.controller.ts`
- `apps/backend/src/ai/ai.service.ts`
- `apps/backend/src/ai/ai-provider.registry.ts`
- `apps/backend/src/ai/dto/ai-transform.dto.ts`
- `apps/backend/src/ai/providers/ai-provider.interface.ts`
- `apps/backend/src/ai/providers/anthropic.provider.ts`
- `apps/backend/src/ai/providers/openai.provider.ts`
- `apps/backend/src/ai/providers/ollama.provider.ts`
- `apps/backend/src/ai/providers/gemini.provider.ts`
- `apps/backend/src/ai/providers/gemini-cli.provider.ts`
- `apps/backend/src/ai/providers/openai-codex.provider.ts`
- `apps/backend/src/ai/providers/claude-cli.provider.ts`
- `apps/backend/src/ai/providers/provider-error.util.ts`
- `apps/backend/src/admin/ai/admin-ai.controller.ts`
- `apps/backend/src/admin/ai/admin-ai.module.ts`

</details>

<details>
<summary>🖥️ Frontend (5 files)</summary>

- `apps/frontend/src/app/(dashboard)/admin/ai/page.tsx`
- `apps/frontend/src/components/features/editor/AiMenu.tsx`
- `apps/frontend/src/hooks/useAdminAi.ts`
- `apps/frontend/src/hooks/useAiStatus.ts`
- `apps/frontend/src/hooks/useAiTransform.ts`

</details>

### 🗄️ Database
- New `AiConfig` model in Prisma schema — stores provider configurations with encrypted credentials

---

## [2.5.1] — 2026-03-26

- 📱 Mobile responsive fixes across all dashboard pages
- 🔧 Admin page header overflow fix
- 📲 Mobile sidebar rewrite with dedicated components
- ✏️ Page editor mobile layout improvements

## [2.5.0] — 2026-03-24

- 🎉 Initial public release
