# Wikso Backend

A self-hosted wiki/knowledge base backend with full feature set (Auth, Users, Spaces, Pages, Comments, Attachments, Search, Realtime Collaboration).

## 🛠️ Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** NestJS (modular architecture)
- **Database:** PostgreSQL + JSONB (via Prisma ORM v7)
- **Cache/Sessions:** Redis
- **Storage:** MinIO (S3-compatible)
- **Search:** Meilisearch
- **Realtime:** Hocuspocus (WebSocket server for Yjs, port 1234)
- **Auth:** Passport.js (JWT, OAuth2: Google, GitHub, etc.)
- **Docker:** Docker Compose for all services

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js (for local dev, optional)

### Setup

1. **Clone repository**
   ```bash
   git clone git@github.com:veloxico/wikso.git
   cd wikso
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env if needed (default values work for local dev)
   ```

3. **Start Services**
   ```bash
   docker compose up -d
   ```
   This starts API (port 3000), Hocuspocus (port 1234), Postgres (5432), Redis (6379), MinIO (9000/9001), Meilisearch (7700).

4. **Apply Migrations**
   ```bash
   docker compose run api npx prisma migrate dev
   ```

5. **Access API**
   - Swagger Documentation: http://localhost:3000/api
   - Hocuspocus WebSocket: ws://localhost:1234
   - MinIO Console: http://localhost:9001 (user: minioadmin, pass: minioadmin)
   - Meilisearch: http://localhost:7700 (key: masterKey)

## 📦 Modules Implemented

- **Auth:** Local registration/login, JWT, Refresh Token, Password Reset, OAuth2 strategies.
- **Users:** Profile management, Admin user management.
- **Spaces:** CRUD for wiki spaces, permissions, members.
- **Pages:** Hierarchical page tree (recursive), version history, move/reorder pages.
- **Comments:** Threaded comments on pages.
- **Attachments:** File upload to MinIO, secure download links.
- **Search:** Full-text search via Meilisearch.
- **Notifications:** User notifications system.
- **Webhooks:** Event system for integrations.
- **Admin:** System stats, audit logs, user management.
- **Hocuspocus:** Collaborative editing backend.

## 🧪 Testing

Run unit tests:
```bash
npm run test
```
