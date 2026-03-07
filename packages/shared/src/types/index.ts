// === Enums ===
export enum GlobalRole {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

export enum SpaceType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  PERSONAL = 'PERSONAL',
}

export enum SpaceRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  GUEST = 'GUEST',
}

export enum PageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

// === Models ===
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  role: GlobalRole;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  slug: string;
  name: string;
  description?: string;
  type: SpaceType;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface Page {
  id: string;
  spaceId: string;
  parentId?: string;
  title: string;
  slug: string;
  contentJson?: Record<string, unknown>;
  status: PageStatus;
  authorId: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  children?: Page[];
  author?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  tags?: PageTag[];
}

export interface PageVersion {
  id: string;
  pageId: string;
  contentJson: Record<string, unknown>;
  authorId: string;
  createdAt: string;
  author?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface Comment {
  id: string;
  pageId: string;
  parentId?: string;
  authorId: string;
  content: string;
  selectionStart?: number;
  selectionEnd?: number;
  createdAt: string;
  updatedAt: string;
  children?: Comment[];
  author?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface Attachment {
  id: string;
  pageId: string;
  uploaderId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface PageTag {
  pageId: string;
  tagId: string;
  tag?: Tag;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface SpacePermission {
  id: string;
  spaceId: string;
  userId: string;
  role: SpaceRole;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

export interface PagePermission {
  id: string;
  pageId: string;
  userId: string;
  canView: boolean;
  canEdit: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: string;
}

// === Auth ===
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

// === API Types ===
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  spaceId: string;
  spaceName?: string;
  excerpt?: string;
  authorId: string;
  updatedAt: string;
}
