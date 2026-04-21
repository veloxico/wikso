import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PageLinksService } from '../page-links/page-links.service';
import { PageWatchService } from '../page-watch/page-watch.service';
import { Prisma } from '@prisma/client';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

@Injectable()
export class PagesService {
  private logger = new Logger(PagesService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private searchService: SearchService,
    private notificationsService: NotificationsService,
    private webhooksService: WebhooksService,
    private pageLinks: PageLinksService,
    private pageWatch: PageWatchService,
  ) {}

  /** Invalidate tree cache for a space slug */
  private async invalidateTreeCache(spaceSlug: string) {
    try {
      await this.redis.del(`cache:tree:${spaceSlug}`);
    } catch {
      // Non-critical
    }
  }

  async create(spaceSlug: string, dto: CreatePageDto, authorId: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    // Validate parentId if provided
    if (dto.parentId) {
      const parent = await this.prisma.page.findUnique({
        where: { id: dto.parentId },
        select: { id: true, spaceId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt) throw new NotFoundException('Parent page not found');
      if (parent.spaceId !== space.id) throw new ForbiddenException('Parent page must be in the same space');
    }

    const slug = slugify(dto.title) + '-' + Date.now().toString(36);
    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        slug,
        contentJson: (dto.contentJson || {}) as Prisma.InputJsonValue,
        parentId: dto.parentId,
        status: dto.status || 'DRAFT',
        spaceId: space.id,
        authorId,
      },
    });

    // Create initial version
    await this.prisma.pageVersion.create({
      data: { pageId: page.id, contentJson: page.contentJson || {}, authorId },
    });

    // Author auto-subscribes to their own page so they receive future
    // edit notifications without having to click "Watch" themselves.
    void this.pageWatch.ensureWatching(page.id, authorId);

    // Templates can ship with internal links — index them right away so
    // backlinks show up without waiting for the first edit.
    if (dto.contentJson) {
      void this.pageLinks.syncLinksFromContent(page.id, dto.contentJson);
    }

    // Index in search
    await this.searchService.indexPage(page, { slug: spaceSlug, name: space.name });

    // Invalidate tree cache
    await this.invalidateTreeCache(spaceSlug);

    // Notify all space members (except the author)
    await this.notifySpaceMembers(space.id, authorId, 'page.created', {
      pageId: page.id,
      pageTitle: page.title,
      spaceSlug,
      spaceName: space.name,
    });

    // Fire webhook
    await this.webhooksService.fireEvent('page.created', {
      pageId: page.id,
      title: page.title,
      spaceSlug,
      authorId,
    });

    return page;
  }

  async getTree(spaceSlug: string) {
    // Try Redis cache first
    const cacheKey = `cache:tree:${spaceSlug}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Cache miss or error — proceed to DB
    }

    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    const pages: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE page_tree AS (
        SELECT id, title, slug, "parentId", position, status, "authorId", "createdAt", "updatedAt", 0 as depth
        FROM "Page"
        WHERE "spaceId" = ${space.id} AND "parentId" IS NULL AND "deletedAt" IS NULL
        UNION ALL
        SELECT p.id, p.title, p.slug, p."parentId", p.position, p.status, p."authorId", p."createdAt", p."updatedAt", pt.depth + 1
        FROM "Page" p
        INNER JOIN page_tree pt ON p."parentId" = pt.id
        WHERE p."deletedAt" IS NULL
      )
      SELECT * FROM page_tree ORDER BY depth, position
    `;

    const tree = this.buildTree(pages);

    // Cache for 60 seconds
    try {
      await this.redis.set(cacheKey, JSON.stringify(tree), 60);
    } catch {
      // Non-critical
    }

    return tree;
  }

  private buildTree(pages: any[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const page of pages) {
      map.set(page.id, { ...page, children: [] });
    }

    for (const page of pages) {
      const node = map.get(page.id);
      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findById(pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!page || page.deletedAt) throw new NotFoundException('Page not found');
    return page;
  }

  /** Walk up the parent chain and return ancestors from root to direct parent */
  async getAncestors(pageId: string) {
    const ancestors: { id: string; title: string; slug: string }[] = await this.prisma.$queryRaw`
      WITH RECURSIVE ancestors AS (
        SELECT id, title, slug, "parentId"
        FROM "Page"
        WHERE id = (SELECT "parentId" FROM "Page" WHERE id = ${pageId} AND "deletedAt" IS NULL)
          AND "deletedAt" IS NULL
        UNION ALL
        SELECT p.id, p.title, p.slug, p."parentId"
        FROM "Page" p
        INNER JOIN ancestors a ON p.id = a."parentId"
        WHERE p."deletedAt" IS NULL
      )
      SELECT id, title, slug FROM ancestors
    `;
    // The recursive CTE returns child-first → root-last, so reverse
    return ancestors.reverse();
  }

  async update(pageId: string, dto: UpdatePageDto, userId: string) {
    const existing = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Page not found');

    const page = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.title !== undefined && dto.title !== '' && { title: dto.title }),
        ...(dto.contentJson !== undefined && { contentJson: dto.contentJson as Prisma.InputJsonValue }),
        ...(dto.status && { status: dto.status }),
      },
      include: { space: true },
    });

    if (dto.contentJson !== undefined) {
      await this.prisma.pageVersion.create({
        data: { pageId, contentJson: dto.contentJson as Prisma.InputJsonValue, authorId: userId },
      });

      // Reconcile backlinks asynchronously — fire-and-forget so a failure in
      // the derived index can't block the user's save. The service swallows
      // and logs its own errors; we void the promise just to satisfy lint.
      void this.pageLinks.syncLinksFromContent(pageId, dto.contentJson);
    }

    await this.searchService.indexPage(page, page.space ? { slug: page.space.slug, name: page.space.name } : undefined);

    // Invalidate tree cache
    if (page.space) {
      await this.invalidateTreeCache(page.space.slug);
    }

    // Notify watchers about the update (excluding the actor). Updates can
    // be high-frequency, so we deliberately avoid blasting every space
    // member — they can opt in by clicking "Watch" on the page.
    if (page.space) {
      await this.notifyWatchers(page.id, userId, 'page.updated', {
        pageId: page.id,
        pageTitle: page.title,
        spaceSlug: page.space.slug,
        spaceName: page.space.name,
      });
    }

    // Fire webhook
    await this.webhooksService.fireEvent('page.updated', {
      pageId: page.id,
      title: page.title,
      updatedBy: userId,
    });

    return page;
  }

  /** Soft-delete: move page to trash */
  async delete(pageId: string, userId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { space: true },
    });
    if (!page || page.deletedAt) throw new NotFoundException('Page not found');

    await this.prisma.page.update({
      where: { id: pageId },
      data: { deletedAt: new Date(), deletedBy: userId },
    });

    // Recursively soft-delete ALL descendants (children, grandchildren, etc.)
    await this.prisma.$executeRaw`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "Page" WHERE "parentId" = ${pageId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT p.id FROM "Page" p
        INNER JOIN descendants d ON p."parentId" = d.id
        WHERE p."deletedAt" IS NULL
      )
      UPDATE "Page" SET "deletedAt" = NOW(), "deletedBy" = ${userId}
      WHERE id IN (SELECT id FROM descendants)
    `;

    // Remove from search index
    await this.searchService.removePage(pageId);

    // Invalidate tree cache
    if (page.space) {
      await this.invalidateTreeCache(page.space.slug);
    }

    // Fire webhook
    await this.webhooksService.fireEvent('page.deleted', {
      pageId,
      title: page.title,
    });

    return { message: 'Page moved to trash' };
  }

  /** List trashed pages in a space */
  async getTrash(spaceSlug: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    return this.prisma.page.findMany({
      where: { spaceId: space.id, deletedAt: { not: null } },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  /** Restore page from trash */
  async restore(pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { space: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    if (!page.deletedAt) throw new NotFoundException('Page is not in trash');

    await this.prisma.page.update({
      where: { id: pageId },
      data: { deletedAt: null, deletedBy: null },
    });

    // Also restore all descendants
    await this.prisma.$executeRaw`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "Page" WHERE "parentId" = ${pageId}
        UNION ALL
        SELECT p.id FROM "Page" p
        INNER JOIN descendants d ON p."parentId" = d.id
      )
      UPDATE "Page" SET "deletedAt" = NULL, "deletedBy" = NULL
      WHERE id IN (SELECT id FROM descendants) AND "deletedAt" IS NOT NULL
    `;

    // Re-index in search
    await this.searchService.indexPage(page, page.space ? { slug: page.space.slug, name: page.space.name } : undefined);

    // Invalidate tree cache
    if (page.space) {
      await this.invalidateTreeCache(page.space.slug);
    }

    return { message: 'Page restored' };
  }

  /** Permanently delete a page from trash (admin only) */
  async permanentDelete(pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Page not found');
    if (!page.deletedAt) throw new ForbiddenException('Page must be in trash before permanent deletion');

    await this.searchService.removePage(pageId);
    await this.prisma.page.delete({ where: { id: pageId } });

    return { message: 'Page permanently deleted' };
  }

  async move(pageId: string, dto: MovePageDto) {
    const existing = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { space: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundException('Page not found');

    // Validate parentId if provided
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === pageId) {
        throw new ForbiddenException('A page cannot be its own parent');
      }

      const parent = await this.prisma.page.findUnique({
        where: { id: dto.parentId },
        select: { id: true, spaceId: true, deletedAt: true },
      });
      if (!parent || parent.deletedAt) throw new NotFoundException('Target parent page not found');
      if (parent.spaceId !== existing.spaceId) {
        throw new ForbiddenException('Cannot move page to a different space');
      }

      // Circular reference check — single recursive CTE instead of N+1 queries
      const ancestors: Array<{ id: string }> = await this.prisma.$queryRaw`
        WITH RECURSIVE ancestors AS (
          SELECT id, "parentId" FROM "Page" WHERE id = ${dto.parentId}::uuid
          UNION ALL
          SELECT p.id, p."parentId" FROM "Page" p
          INNER JOIN ancestors a ON p.id = a."parentId"
        )
        SELECT id FROM ancestors WHERE id = ${pageId}::uuid LIMIT 1
      `;
      if (ancestors.length > 0) {
        throw new ForbiddenException('Cannot move page under its own descendant');
      }
    }

    const result = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });

    // Invalidate tree cache
    if (existing.space) {
      await this.invalidateTreeCache(existing.space.slug);
    }

    return result;
  }

  async getVersions(pageId: string, skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.pageVersion.findMany({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        skip,
        take,
      }),
      this.prisma.pageVersion.count({ where: { pageId } }),
    ]);

    return { data, total, skip, take };
  }

  async getVersion(pageId: string, versionId: string) {
    const version = await this.prisma.pageVersion.findFirst({
      where: { id: versionId, pageId },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async restoreVersion(pageId: string, versionId: string, userId: string) {
    const version = await this.getVersion(pageId, versionId);

    // Clear yjsState so Hocuspocus rebuilds from contentJson on next connection.
    // Without this, the editor would still load the old Yjs binary state.
    const page = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        contentJson: version.contentJson || {},
        yjsState: null,
      },
      include: { space: true },
    });

    // Create a new version for the restore
    await this.prisma.pageVersion.create({
      data: { pageId, contentJson: version.contentJson || {}, authorId: userId },
    });

    // The restored snapshot may have a different set of internal links than
    // what was current — reconcile the backlink graph.
    void this.pageLinks.syncLinksFromContent(pageId, version.contentJson);

    await this.searchService.indexPage(page, page.space ? { slug: page.space.slug, name: page.space.name } : undefined);

    return page;
  }

  /** Duplicate a page */
  async duplicate(pageId: string, userId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { space: true, tags: true },
    });
    if (!page || page.deletedAt) throw new NotFoundException('Page not found');

    const slug = slugify(page.title) + '-copy-' + Date.now().toString(36);
    const copy = await this.prisma.page.create({
      data: {
        title: `${page.title} (Copy)`,
        slug,
        contentJson: page.contentJson || {},
        parentId: page.parentId,
        status: 'DRAFT',
        spaceId: page.spaceId,
        authorId: userId,
      },
    });

    // Copy tags
    if (page.tags.length > 0) {
      await this.prisma.pageTag.createMany({
        data: page.tags.map((pt) => ({ pageId: copy.id, tagId: pt.tagId })),
      });
    }

    // Create initial version
    await this.prisma.pageVersion.create({
      data: { pageId: copy.id, contentJson: page.contentJson || {}, authorId: userId },
    });

    // Mirror the source page's outbound links into the copy. Links pointing
    // to the original itself are intentionally kept — that's a feature of
    // duplicating reference material.
    void this.pageLinks.syncLinksFromContent(copy.id, page.contentJson);

    // Index in search
    if (page.space) {
      await this.searchService.indexPage(copy, { slug: page.space.slug, name: page.space.name });
    }

    return copy;
  }

  /** Get popular pages by view count */
  async getPopular(spaceSlug: string, period: string = '7d') {
    // Try Redis cache first (5 min TTL)
    const cacheKey = `cache:popular:${spaceSlug}:${period}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Cache miss or error — proceed to DB
    }

    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    const days = period === '30d' ? 30 : period === '14d' ? 14 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const popular: any[] = await this.prisma.$queryRaw`
      SELECT p.id, p.title, p.slug, p."authorId", p."createdAt", p."updatedAt",
             COUNT(pv.id)::int as "viewCount"
      FROM "Page" p
      INNER JOIN "PageView" pv ON pv."pageId" = p.id
      WHERE p."spaceId" = ${space.id}
        AND p."deletedAt" IS NULL
        AND pv."createdAt" >= ${since}
      GROUP BY p.id
      ORDER BY "viewCount" DESC
      LIMIT 20
    `;

    // Cache for 5 minutes
    try {
      await this.redis.set(cacheKey, JSON.stringify(popular), 300);
    } catch {
      // Non-critical
    }

    return popular;
  }

  /**
   * Notify all members of a space except the actor.
   *
   * Used for low-frequency, discoverability-flavored events such as
   * `page.created`. For per-page edits, prefer `notifyWatchers` so users
   * can self-curate their inbox.
   */
  private async notifySpaceMembers(
    spaceId: string,
    actorId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    try {
      const members = await this.prisma.spacePermission.findMany({
        where: { spaceId },
        select: { userId: true },
      });

      const promises = members
        .filter((m) => m.userId && m.userId !== actorId)
        .map((m) => this.notificationsService.create(m.userId!, type, payload));

      await Promise.all(promises);
    } catch {
      // Non-critical — don't break the main flow
    }
  }

  /**
   * Notify everybody who has explicitly subscribed to a page (via
   * `PageWatch`) excluding the actor. Authors are auto-subscribed on
   * page create + via the migration backfill, so this preserves the
   * "the author always hears about edits to their page" behaviour even
   * though we no longer blast every space member.
   */
  private async notifyWatchers(
    pageId: string,
    actorId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    try {
      const userIds = await this.pageWatch.getWatcherIds(pageId, actorId);
      await Promise.all(
        userIds.map((uid) => this.notificationsService.create(uid, type, payload)),
      );
    } catch {
      // Non-critical — never let a notification glitch fail a save.
    }
  }
}
