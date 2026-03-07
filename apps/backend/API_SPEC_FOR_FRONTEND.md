# Confluence Backend — API Specification for Frontend

**Base URL:** `https://veloxico.com/api` (после деплоя)  
**Auth:** Bearer JWT в заголовке `Authorization: Bearer <token>`  
**Content-Type:** `application/json` (кроме upload файлов — `multipart/form-data`)  
**Swagger:** `/api` (автогенерация через NestJS/Swagger)

---

## Enums

```typescript
enum GlobalRole { ADMIN = "ADMIN", VIEWER = "VIEWER" }
enum SpaceType  { PUBLIC = "PUBLIC", PRIVATE = "PRIVATE", PERSONAL = "PERSONAL" }
enum SpaceRole  { ADMIN = "ADMIN", EDITOR = "EDITOR", VIEWER = "VIEWER", GUEST = "GUEST" }
enum PageStatus { DRAFT = "DRAFT", PUBLISHED = "PUBLISHED", ARCHIVED = "ARCHIVED" }
```

---

## 1. Auth (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Регистрация |
| GET | `/auth/verify-email?token=` | ❌ | Подтверждение email |
| POST | `/auth/login` | ❌ | Логин (email + password) |
| POST | `/auth/refresh` | ❌ | Обновление access token |
| POST | `/auth/forgot-password` | ❌ | Запрос сброса пароля |
| POST | `/auth/reset-password` | ❌ | Сброс пароля по токену |
| POST | `/auth/logout` | ✅ | Выход |
| GET | `/auth/google` | ❌ | OAuth2 Google (redirect) |
| GET | `/auth/google/callback` | ❌ | Google callback |
| GET | `/auth/github` | ❌ | OAuth2 GitHub (redirect) |
| GET | `/auth/github/callback` | ❌ | GitHub callback |

### Request/Response:

**POST /auth/register**
```json
// Request
{ "email": "user@example.com", "name": "User Name", "password": "password123" }
// Response
{ "accessToken": "jwt...", "refreshToken": "jwt...", "user": { "id", "email", "name", "role" } }
```

**POST /auth/login**
```json
// Request
{ "email": "user@example.com", "password": "password123" }
// Response
{ "accessToken": "jwt...", "refreshToken": "jwt...", "user": { "id", "email", "name", "role" } }
```

**POST /auth/refresh**
```json
// Request
{ "refreshToken": "jwt..." }
// Response
{ "accessToken": "jwt...", "refreshToken": "jwt..." }
```

**POST /auth/forgot-password**
```json
{ "email": "user@example.com" }
```

**POST /auth/reset-password**
```json
{ "token": "token-uuid", "password": "newpassword123" }
```

---

## 2. Users (`/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | ✅ | Текущий профиль |
| PATCH | `/users/me` | ✅ | Обновить профиль |
| GET | `/users/:id` | ✅ | Профиль по ID |

### Models:

**User**
```typescript
{
  id: string           // UUID
  email: string
  name: string
  avatarUrl?: string
  emailVerified: boolean
  role: GlobalRole     // "ADMIN" | "VIEWER"
  createdAt: string    // ISO 8601
  updatedAt: string
}
```

**PATCH /users/me**
```json
{ "name?": "New Name", "avatarUrl?": "https://..." }
```

---

## 3. Spaces (`/spaces`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/spaces` | ✅ | Создать пространство |
| GET | `/spaces` | ✅ | Список доступных пространств |
| GET | `/spaces/:slug` | ✅ | Пространство по slug |
| PATCH | `/spaces/:slug` | ✅ | Обновить пространство |
| DELETE | `/spaces/:slug` | ✅ | Удалить пространство |
| GET | `/spaces/:slug/members` | ✅ | Список участников |
| POST | `/spaces/:slug/members` | ✅ | Добавить участника |
| DELETE | `/spaces/:slug/members/:userId` | ✅ | Убрать участника |

### Models:

**Space**
```typescript
{
  id: string
  slug: string         // URL-friendly unique identifier
  name: string
  description?: string
  type: SpaceType      // "PUBLIC" | "PRIVATE" | "PERSONAL"
  ownerId: string
  createdAt: string
  updatedAt: string
}
```

**POST /spaces**
```json
{ "name": "Engineering", "slug": "engineering", "description?": "...", "type?": "PUBLIC" }
```

**PATCH /spaces/:slug**
```json
{ "name?": "...", "description?": "...", "type?": "PRIVATE" }
```

**POST /spaces/:slug/members**
```json
{ "userId": "uuid", "role": "EDITOR" }
```

---

## 4. Pages (`/spaces/:slug/pages`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/spaces/:slug/pages` | ✅ | Создать страницу |
| GET | `/spaces/:slug/pages` | ✅ | Дерево страниц |
| GET | `/spaces/:slug/pages/:pageId` | ✅ | Страница по ID |
| PATCH | `/spaces/:slug/pages/:pageId` | ✅ | Обновить страницу |
| DELETE | `/spaces/:slug/pages/:pageId` | ✅ | Удалить страницу |
| PATCH | `/spaces/:slug/pages/:pageId/move` | ✅ | Переместить страницу |
| GET | `/spaces/:slug/pages/:pageId/versions` | ✅ | История версий |
| GET | `/spaces/:slug/pages/:pageId/versions/:versionId` | ✅ | Конкретная версия |

### Models:

**Page**
```typescript
{
  id: string
  spaceId: string
  parentId?: string    // null = root page
  title: string
  slug: string         // auto-generated from title
  contentJson?: any    // TipTap/ProseMirror JSON or Yjs-compatible
  status: PageStatus   // "DRAFT" | "PUBLISHED" | "ARCHIVED"
  authorId: string
  position: number     // ordering among siblings
  createdAt: string
  updatedAt: string
  children?: Page[]    // in tree response
}
```

**POST /spaces/:slug/pages**
```json
{ "title": "Getting Started", "parentId?": "uuid", "contentJson?": {...}, "status?": "DRAFT" }
```

**PATCH /spaces/:slug/pages/:pageId**
```json
{ "title?": "...", "contentJson?": {...}, "status?": "PUBLISHED" }
```

**PATCH /spaces/:slug/pages/:pageId/move**
```json
{ "parentId?": "uuid-or-null", "position?": 2 }
```

**PageVersion**
```typescript
{ id: string, pageId: string, contentJson: any, authorId: string, createdAt: string }
```

---

## 5. Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/pages/:pageId/comments` | ✅ | Создать комментарий |
| GET | `/pages/:pageId/comments` | ✅ | Комментарии к странице |
| PATCH | `/comments/:id` | ✅ | Обновить комментарий |
| DELETE | `/comments/:id` | ✅ | Удалить комментарий |

### Models:

**Comment**
```typescript
{
  id: string
  pageId: string
  parentId?: string       // null = top-level, string = reply to comment
  authorId: string
  content: string         // markdown or plain text
  selectionStart?: number // inline comment anchor (char offset)
  selectionEnd?: number
  createdAt: string
  updatedAt: string
  children?: Comment[]    // threaded replies
}
```

**POST /pages/:pageId/comments**
```json
{ "content": "Great article!", "parentId?": "uuid", "selectionStart?": 100, "selectionEnd?": 150 }
```

**PATCH /comments/:id**
```json
{ "content": "Updated comment" }
```

---

## 6. Attachments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/pages/:pageId/attachments` | ✅ | Upload файла (multipart/form-data, field: `file`) |
| GET | `/pages/:pageId/attachments` | ✅ | Список файлов страницы |
| DELETE | `/attachments/:id` | ✅ | Удалить файл |
| GET | `/attachments/:id/download` | ✅ | Получить presigned URL для скачивания |

### Models:

**Attachment**
```typescript
{
  id: string
  pageId: string
  uploaderId: string
  filename: string
  mimeType: string
  size: number        // bytes
  storageKey: string  // internal MinIO key
  createdAt: string
}
```

---

## 7. Search (`/search`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search?q=&spaceId=&authorId=&tags=` | ✅ | Полнотекстовый поиск (Meilisearch) |

**Query params:**
- `q` (required) — поисковый запрос
- `spaceId` (optional) — фильтр по пространству
- `authorId` (optional) — фильтр по автору
- `tags` (optional) — фильтр по тегам (comma-separated)

---

## 8. Notifications (`/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | Список уведомлений текущего юзера |
| PATCH | `/notifications/:id/read` | ✅ | Пометить как прочитанное |
| PATCH | `/notifications/read-all` | ✅ | Пометить все как прочитанные |

### Models:

**Notification**
```typescript
{
  id: string
  userId: string
  type: string        // e.g. "comment.created", "page.updated", "mention"
  payload: any        // JSON with context (pageId, commentId, actorId, etc.)
  read: boolean
  createdAt: string
}
```

---

## 9. Webhooks (`/webhooks`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhooks` | ✅ | Создать вебхук |
| GET | `/webhooks` | ✅ | Список вебхуков |
| DELETE | `/webhooks/:id` | ✅ | Удалить вебхук |

**POST /webhooks**
```json
{ "url": "https://example.com/hook", "events": ["page.created", "comment.created"], "secret?": "..." }
```

---

## 10. Admin (`/admin`) — только ADMIN

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/users?skip=&take=` | ✅ ADMIN | Список всех юзеров |
| PATCH | `/admin/users/:id` | ✅ ADMIN | Обновить юзера |
| PATCH | `/admin/users/:id/role` | ✅ ADMIN | Изменить роль |
| DELETE | `/admin/users/:id` | ✅ ADMIN | Удалить юзера |
| GET | `/admin/audit-log?skip=&take=` | ✅ ADMIN | Аудит-лог |
| GET | `/admin/stats` | ✅ ADMIN | Системная статистика |

**PATCH /admin/users/:id/role**
```json
{ "role": "ADMIN" }
```

---

## 11. Realtime Collaboration (WebSocket)

- **Endpoint:** `ws://<host>:1234`
- **Protocol:** Hocuspocus (Yjs provider)
- **Document name:** `page:<pageId>`
- **Auth:** JWT передаётся при подключении

Фронт подключается через `@hocuspocus/provider` и работает с Yjs документами для realtime-редактирования страниц.

---

## Фронтовые страницы (рекомендация)

| Страница | Описание |
|----------|----------|
| `/login` | Логин + OAuth кнопки |
| `/register` | Регистрация |
| `/forgot-password` | Сброс пароля |
| `/spaces` | Список пространств (dashboard) |
| `/spaces/:slug` | Пространство: дерево страниц + sidebar |
| `/spaces/:slug/pages/:pageId` | Страница: редактор (TipTap/ProseMirror) + комментарии |
| `/spaces/:slug/settings` | Настройки пространства + участники |
| `/search` | Глобальный поиск |
| `/notifications` | Уведомления |
| `/profile` | Профиль пользователя |
| `/admin` | Админка: юзеры, аудит, статистика |

---

## Технические заметки для фронта

1. **Контент страниц** хранится в `contentJson` — это JSON-совместимый с TipTap/ProseMirror. Рекомендую использовать **TipTap** как редактор.
2. **Realtime** — Hocuspocus + Yjs. Подключение через `@hocuspocus/provider`. Документ = `page:<pageId>`.
3. **Файлы** загружаются через multipart/form-data, скачиваются через presigned URL из MinIO.
4. **Пагинация** — через `skip`/`take` query params (admin endpoints). Остальные пока без пагинации (можно добавить).
5. **Ошибки** — стандартные HTTP коды + JSON `{ statusCode, message, error }`.
6. **CORS** — настроен на бэке, фронт может быть на отдельном домене/порте.
