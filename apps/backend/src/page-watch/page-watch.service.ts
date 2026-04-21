import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Per-user page watching ("subscribe to changes"). The data model is a
 * simple `(userId, pageId)` pair with a unique constraint, so creating a
 * watch is idempotent and removing it is a single delete.
 *
 * Watch enrollment determines who receives `page.updated` notifications.
 * To keep the existing UX intact:
 *   - Page authors auto-watch their own pages on create (handled by
 *     PagesService).
 *   - Existing pages got a one-shot backfill in the migration.
 *   - Anyone can opt in / out at any time from the page UI.
 *
 * IDOR shield: every entry point pins the page by `(id, space.slug)` so a
 * leaked pageId from one space can't be used to subscribe to another.
 */
@Injectable()
export class PageWatchService {
  constructor(private readonly prisma: PrismaService) {}

  async watch(pageId: string, slug: string, userId: string) {
    await this.assertPageInSpace(pageId, slug);
    // upsert keeps the call idempotent — a double-click on Watch never errors
    await this.prisma.pageWatch.upsert({
      where: { userId_pageId: { userId, pageId } },
      create: { userId, pageId },
      update: {},
    });
    return this.status(pageId, slug, userId);
  }

  async unwatch(pageId: string, slug: string, userId: string) {
    await this.assertPageInSpace(pageId, slug);
    // deleteMany so we don't error when there's no row (idempotent)
    await this.prisma.pageWatch.deleteMany({
      where: { userId, pageId },
    });
    return this.status(pageId, slug, userId);
  }

  /** Lightweight `{ watching, watcherCount }` for the toggle button. */
  async status(pageId: string, slug: string, userId: string) {
    await this.assertPageInSpace(pageId, slug);
    const [mine, watcherCount] = await Promise.all([
      this.prisma.pageWatch.findUnique({
        where: { userId_pageId: { userId, pageId } },
        select: { id: true },
      }),
      this.prisma.pageWatch.count({ where: { pageId } }),
    ]);
    return { watching: !!mine, watcherCount };
  }

  /**
   * Returns userIds of every active watcher for the page, optionally
   * excluding the actor (used by fan-out to skip the user who triggered
   * the event so they don't get notified about their own action).
   */
  async getWatcherIds(pageId: string, excludeUserId?: string): Promise<string[]> {
    const watches = await this.prisma.pageWatch.findMany({
      where: {
        pageId,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { userId: true },
    });
    return watches.map((w) => w.userId);
  }

  /** Auto-enroll a user — used when authoring a page or replying for the first time. */
  async ensureWatching(pageId: string, userId: string) {
    try {
      await this.prisma.pageWatch.upsert({
        where: { userId_pageId: { userId, pageId } },
        create: { userId, pageId },
        update: {},
      });
    } catch {
      // Non-critical — if the user record was just deleted or page was
      // soft-deleted concurrently, swallow rather than break the caller.
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async assertPageInSpace(pageId: string, slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null, space: { slug } },
      select: { id: true },
    });
    if (!page) throw new NotFoundException('Page not found');
  }
}
