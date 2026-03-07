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

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
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
