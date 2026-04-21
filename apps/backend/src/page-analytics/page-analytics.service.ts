import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/** Period keyword → number of UTC days included in the report. */
const PERIODS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/**
 * Per-page analytics. Reads the `PageView` log that the rest of the app
 * already maintains (see RecentPagesService.recordVisit) and folds it into
 * a few rollups suitable for a small in-page chart.
 *
 * Privacy decisions:
 * - We never return a per-user list. The dialog shows totals and a daily
 *   trend; surfacing "Anna read your page 14 times" is a workplace-trust
 *   problem we don't need to create.
 * - Access requires VIEWER+ in the space (the SpacePermissionGuard handles
 *   that; this service additionally pins the page to the URL slug to close
 *   IDOR by a wandering pageId).
 * - Anonymous views (PageView.userId IS NULL) — produced by guest share
 *   links — are counted in totalViews but folded into a single "anonymous"
 *   bucket for uniqueViewers so we don't over-report uniques.
 */
@Injectable()
export class PageAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(pageId: string, slug: string, periodKey: string) {
    const days = PERIODS[periodKey];
    if (!days) {
      // Defend against arbitrary input — invalid period falls back to 30d
      // rather than throwing, since the dialog might race the user typing.
      return this.getStats(pageId, slug, '30d');
    }

    await this.assertPageInSpace(pageId, slug);

    // Window starts at midnight UTC `days` ago so the dailyCounts buckets
    // line up with calendar days rather than wall-clock seconds.
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    // ── Totals (lifetime, in-window, uniques in-window) ─────────────────
    const [totalViews, viewsInPeriod, uniqueAuthed, anyAnonymous] = await Promise.all([
      this.prisma.pageView.count({ where: { pageId } }),
      this.prisma.pageView.count({ where: { pageId, createdAt: { gte: since } } }),
      this.prisma.pageView.findMany({
        where: { pageId, userId: { not: null }, createdAt: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.pageView.findFirst({
        where: { pageId, userId: null, createdAt: { gte: since } },
        select: { id: true },
      }),
    ]);

    const uniqueViewers = uniqueAuthed.length + (anyAnonymous ? 1 : 0);

    // ── Per-day rollup, computed in Postgres ────────────────────────────
    // We use a raw query for `date_trunc` so we get one row per UTC day
    // even on days with zero views (filled in below).
    type Row = { day: Date; views: bigint; users: bigint };
    const rows = await this.prisma.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*)::bigint AS views,
               COUNT(DISTINCT "userId")::bigint AS users
          FROM "PageView"
         WHERE "pageId" = ${pageId}
           AND "createdAt" >= ${since}
         GROUP BY 1
         ORDER BY 1 ASC
      `,
    );

    const byDay = new Map<string, { views: number; uniqueUsers: number }>();
    for (const r of rows) {
      const key = r.day.toISOString().slice(0, 10);
      byDay.set(key, { views: Number(r.views), uniqueUsers: Number(r.users) });
    }

    const dailyCounts: { date: string; views: number; uniqueUsers: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyCounts.push({
        date: key,
        views: byDay.get(key)?.views ?? 0,
        uniqueUsers: byDay.get(key)?.uniqueUsers ?? 0,
      });
    }

    return {
      period: periodKey,
      since: since.toISOString(),
      totalViews,
      viewsInPeriod,
      uniqueViewers,
      dailyCounts,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async assertPageInSpace(pageId: string, slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null, space: { slug } },
      select: { id: true },
    });
    if (!page) throw new NotFoundException('Page not found');
  }

  /** Reserved for future per-page export gating — admin-only. */
  ensureAdmin(user: { role?: string }) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admins only');
  }
}
