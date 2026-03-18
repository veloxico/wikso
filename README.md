# Wikso

**Wikso** — open-source, self-hosted alternative to Confluence. Real-time collaborative editing, page trees, spaces, full-text search, version history, and more.

[![GitHub Release](https://img.shields.io/github/v/release/veloxico/wikso?style=flat&logo=github)](https://github.com/veloxico/wikso/releases)
[![Docker Pulls BE](https://img.shields.io/docker/pulls/veloxico/wikso-be?style=flat&logo=docker&label=pulls%20(backend))](https://hub.docker.com/r/veloxico/wikso-be)
[![Docker Pulls FE](https://img.shields.io/docker/pulls/veloxico/wikso-fe?style=flat&logo=docker&label=pulls%20(frontend))](https://hub.docker.com/r/veloxico/wikso-fe)
[![License](https://img.shields.io/github/license/veloxico/wikso?style=flat)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/veloxico?style=flat&logo=githubsponsors&label=Sponsor)](https://github.com/sponsors/veloxico)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat&logo=ko-fi)](https://ko-fi.com/alexkoss)
[![Crypto Donate](https://img.shields.io/badge/Crypto-Donate-blue?style=flat&logo=bitcoin)](#support-the-project)

> **Live Demo:** [wikso.veloxico.com](https://wikso.veloxico.com)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TailwindCSS 4, shadcn/ui, TipTap, Yjs |
| **Backend** | NestJS 11, Prisma 6, PostgreSQL 16 |
| **Real-time** | Hocuspocus (Yjs WebSocket server) |
| **Search** | Meilisearch |
| **File Storage** | S3 / MinIO |
| **Cache & Queues** | Redis |
| **Auth** | JWT + Refresh tokens, Google OAuth, GitHub OAuth, SAML SSO |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Containerization** | Docker Compose |

## Features

### Content & Editing
- **Spaces & Page Trees** — organize content in workspaces with nested page hierarchies
- **Real-time Collaboration** — multiple users can edit the same page simultaneously (Yjs + Hocuspocus)
- **Rich Text Editor** — TipTap-based editor with tables, code blocks, callouts, images, mentions, task lists, Mermaid diagrams, and Excalidraw drawings
- **Version History** — automatic snapshots every 5 minutes + manual save, with diff view and one-click restore
- **Full-text Search** — powered by Meilisearch with instant results and command palette (Ctrl+K)
- **Favorites & Recent Pages** — quick access to your most-used content
- **Comments & Reactions** — threaded discussions on any page with emoji reactions
- **Drag & Drop** — reorder pages in the tree via drag and drop
- **Templates** — create pages from predefined templates
- **Page Export** — export pages to PDF / Markdown
- **File Attachments** — upload and attach files to pages (S3 / MinIO), configurable size limit (up to 100 MB)
- **Confluence Import** — migrate from Confluence Cloud with a single ZIP upload (Beta)

### Admin Panel
- **Dashboard** — system stats with 30-day activity charts (pages, views, users)
- **User Management** — create, invite, suspend, delete users; bulk operations; last login & IP tracking
- **Group Management** — organize users into groups with member management
- **Space Administration** — search, filter by type, edit properties, transfer ownership
- **Trash** — restore or permanently delete pages; bulk operations; filter by space
- **Audit Log** — filterable activity log with CSV export
- **Security & Access** — registration control, domain whitelist, email verification, password policy
- **Auth Providers** — Google OAuth, GitHub OAuth, SAML SSO configuration status
- **Email Configuration** — SMTP setup with provider presets and test email
- **Webhooks** — full CRUD: create, edit, delete, enable/disable webhook integrations
- **System Health** — live service status, uptime, memory usage, Node.js version
- **Confluence Import** — upload Confluence Cloud XML export ZIP with real-time progress tracking (Beta)

### Platform
- **Multi-language** — UI available in English, Russian, Belarusian, Spanish, Spanish (AR), Portuguese, Portuguese (BR), Polish, Ukrainian, Chinese
- **Dark Mode** — full dark theme support with system preference detection
- **Responsive** — works on desktop, tablet, and mobile
- **SSO** — Google, GitHub, SAML authentication
- **Notifications** — in-app notifications for page changes
- **Avatar Upload** — profile photo with built-in image cropping
- **Keyboard Shortcuts** — editor shortcuts, command palette, global navigation
- **Multi-arch Docker** — images available for amd64 and arm64

## Quick Start (Docker)

The fastest way to run Wikso — a single command, no build required. Pre-built images are pulled from Docker Hub. Works on **Linux**, **macOS**, and **Windows (WSL2)**.

### Requirements

- [**Docker**](https://docs.docker.com/get-docker/) >= 20.10 and **Docker Compose** v2 (`docker compose` — no hyphen)

### Launch

```bash
git clone https://github.com/veloxico/wikso.git && cd wikso
docker compose up -d
```

That's it. Docker Compose pulls pre-built images from Docker Hub (`veloxico/wikso-be`, `veloxico/wikso-fe`) and starts all 6 services with health-check ordering. No local build, no Node.js, no pnpm required.

### Docker Hub Images

| Image | Architectures | Description |
|-------|---------------|-------------|
| [`veloxico/wikso-be`](https://hub.docker.com/r/veloxico/wikso-be) | amd64, arm64 | Backend — NestJS API + Hocuspocus WS |
| [`veloxico/wikso-fe`](https://hub.docker.com/r/veloxico/wikso-fe) | amd64, arm64 | Frontend — Next.js application |

### Service URLs

| Service | URL |
|---------|-----|
| **Frontend** | [http://localhost:3001](http://localhost:3001) |
| **Backend API** | [http://localhost:3000/api/v1](http://localhost:3000/api/v1) |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) |
| **Meilisearch** | [http://localhost:7700](http://localhost:7700) |

### What happens automatically

1. **PostgreSQL, Redis, MinIO, Meilisearch** start and pass health checks
2. **Backend** image is pulled from Docker Hub (no local build)
3. **Backend** runs Prisma migrations (`prisma migrate deploy`) on first boot
4. **Backend** auto-creates the MinIO S3 bucket (`wikso-uploads`) if it doesn't exist
5. **Frontend** image is pulled from Docker Hub and starts after the backend is healthy
6. **Setup Wizard** — on first launch, open the frontend URL and you'll be guided through creating your admin account. No default credentials or manual seeding required.

### Useful commands

```bash
docker compose up -d          # Start all services (pulls images on first run)
docker compose down            # Stop all services (data is preserved in volumes)
docker compose down -v         # Stop and delete all data (clean slate)
docker compose pull            # Pull latest images from Docker Hub
docker compose logs backend    # View backend logs
docker compose logs frontend   # View frontend logs
```

## Local Development

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** (for PostgreSQL, Redis, MinIO, Meilisearch)

### 1. Start infrastructure

```bash
# Start only the databases / services (without app containers)
docker compose up postgres redis minio meilisearch -d
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — update DATABASE_URL host from "postgres" to "localhost":
#   DATABASE_URL="postgresql://postgres:password@localhost:5432/wikso"
# Also update S3_ENDPOINT, REDIS_HOST, MEILISEARCH_HOST to use localhost

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local
# Usually no changes needed — defaults point to localhost
```

### 4. Setup database

```bash
cd apps/backend
npx prisma db push           # Apply schema to database
npx prisma generate          # Generate Prisma client
cd ../..
```

### 5. Run development servers

```bash
# Start both frontend and backend in parallel
pnpm dev

# Or start them separately:
pnpm dev:backend   # Backend on http://localhost:3000 + Hocuspocus on ws://localhost:1234
pnpm dev:frontend  # Frontend on http://localhost:3001
```

### Building & publishing Docker images

```bash
# Build locally
docker compose build

# Tag and push to Docker Hub
docker tag wikso-backend veloxico/wikso-be:latest
docker tag wikso-frontend veloxico/wikso-fe:latest
docker push veloxico/wikso-be:latest
docker push veloxico/wikso-fe:latest
```

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | — |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `EMAIL_VERIFICATION_REQUIRED` | Require email verification | `false` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `S3_ENDPOINT` | S3/MinIO endpoint | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | S3 bucket name | `wikso-uploads` |
| `MEILISEARCH_HOST` | Meilisearch URL | `http://meilisearch:7700` |
| `MEILISEARCH_API_KEY` | Meilisearch API key | `masterKey` |
| `HOCUSPOCUS_PORT` | WebSocket server port | `1234` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | — |
| `SAML_ENTRY_POINT` | SAML IdP entry point | — |

### Frontend (`apps/frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (browser) | `http://localhost:3000` |
| `NEXT_PUBLIC_WS_URL` | Hocuspocus WebSocket URL | `ws://localhost:1234` |

## Project Structure

```
wikso/
  apps/
    backend/           # NestJS API + Hocuspocus WS server
      src/
        auth/          # JWT, OAuth, SAML authentication
        pages/         # Pages CRUD, versions, tree
        spaces/        # Spaces management
        comments/      # Threaded comments
        search/        # Meilisearch integration
        notifications/ # In-app notifications
        webhooks/      # External webhook events
        users/         # User profiles, avatars
        hocuspocus/    # Real-time collaboration server
        prisma/        # Database schema & migrations
    frontend/          # Next.js application
      src/
        app/           # App router pages & layouts
        components/    # UI & feature components
          ui/          # shadcn/ui primitives
          features/    # Business logic components
        hooks/         # Custom React hooks
        store/         # Zustand stores (auth, sidebar, language)
        i18n/          # Translations (en, ru, be, es, esAR, pt, ptBR, pl, uk, zh)
        lib/           # Utilities, API client
  docker-compose.yml   # Full-stack containerized setup
  package.json         # Monorepo root (Turborepo)
```

## Available Scripts

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps
pnpm lint             # Lint all apps
pnpm test             # Run all tests
pnpm dev:backend      # Start only backend
pnpm dev:frontend     # Start only frontend
pnpm format           # Format code with Prettier
```

## Support the Project

If you find Wikso useful, consider supporting its development:

[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-Support-ea4aaa?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/veloxico)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy_me_a_coffee-ff5e5b?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/alexkoss)

| Network | Address |
|---------|---------|
| **BTC** | `bc1qt5zu44m43f2ca07tedwgund0dxhtpcqkl92afz` |
| **ETH** | `0xaAbcc0B714742525BB97d0594bc4d1DD90Ef5601` |
| **USDT (TRC-20)** | `TAhDQw64uCDdCXKLUmfyjAe1comFPVDj99` |
| **USDT (ERC-20)** | `0xaAbcc0B714742525BB97d0594bc4d1DD90Ef5601` |
| **TON** | `UQA5Z9Lasm_Ke61wYLSuXy7wQnrX7Pefd4RNbDyzBWY9VFjj` |

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

© 2025-2026 Aleks Koss / Veloxico
