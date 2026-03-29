# Changelog

All notable changes to Wikso are documented in this file.

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
