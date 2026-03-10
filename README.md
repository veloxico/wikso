# Wikso

**Wikso** — open-source, self-hosted alternative to Confluence. Real-time collaborative editing, page trees, spaces, full-text search, version history, and more.

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

- **Spaces & Page Trees** — organize content in workspaces with nested page hierarchies
- **Real-time Collaboration** — multiple users can edit the same page simultaneously (Yjs + Hocuspocus)
- **Rich Text Editor** — TipTap-based editor with tables, code blocks, images, mentions, task lists, and more
- **Version History** — automatic snapshots every 5 minutes + manual save, with one-click restore
- **Full-text Search** — powered by Meilisearch with instant results
- **Favorites & Recent Pages** — quick access to your most-used content
- **Comments** — threaded discussions on any page
- **Drag & Drop** — reorder pages in the tree via drag and drop
- **Templates** — create pages from predefined templates
- **Page Export** — export pages to PDF / Markdown
- **File Attachments** — upload and attach files to pages (S3 / MinIO), configurable size limit (up to 100 MB)
- **Avatar Upload** — profile photo with built-in image cropping
- **Notifications** — in-app notifications for page changes
- **Webhooks** — integrate with external services via webhook events
- **Multi-language** — UI available in English, Russian, Spanish, Chinese
- **Dark Mode** — full dark theme support
- **Responsive** — works on desktop and mobile
- **Admin Panel** — user management, space management, security & system settings
- **SSO** — Google, GitHub, SAML authentication

## Quick Start (Docker)

The fastest way to run Wikso — a single command, no build required. Pre-built images are pulled from Docker Hub. Works on **Linux**, **macOS**, and **Windows (WSL2)**.

### Requirements

- **Docker** >= 20.10 and **Docker Compose** v2 (`docker compose` — no hyphen)

### Launch

```bash
git clone <your-repo-url> && cd wikso
docker compose up -d
```

That's it. Docker Compose pulls pre-built images from Docker Hub (`veloxico/wikso-be`, `veloxico/wikso-fe`) and starts all 6 services with health-check ordering. No local build, no Node.js, no pnpm required.

### Docker Hub Images

| Image | Description |
|-------|-------------|
| [`veloxico/wikso-be`](https://hub.docker.com/r/veloxico/wikso-be) | Backend — NestJS API + Hocuspocus WS |
| [`veloxico/wikso-fe`](https://hub.docker.com/r/veloxico/wikso-fe) | Frontend — Next.js application |

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
        i18n/          # Translations (en, ru, es, zh)
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

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

© 2025-2026 Oleksandr Kosenko / Veloxico
