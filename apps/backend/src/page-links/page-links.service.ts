import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Backlinks engine. Walks a page's TipTap/ProseMirror JSON, extracts every
 * internal page reference (links + page-mention nodes), and persists the
 * directed graph in the `PageLink` table so we can answer "what links here?"
 * efficiently for the sidebar's *Mentioned in* panel.
 *
 * Design decisions:
 * - Sync is fully replace-on-write: simpler than diffing, safe under
 *   concurrent edits because each save is its own transaction.
 * - We never trust the contentJson blindly — only UUID-shaped IDs that
 *   resolve to a real, non-deleted Page survive validation. This avoids
 *   polluting the table with garbage from pasted external links.
 * - Backlink lookup re-checks visibility against the requester's space
 *   permissions; a private linker doesn't leak its existence to a viewer who
 *   can't see the source space.
 */
@Injectable()
export class PageLinksService {
  private readonly logger = new Logger(PageLinksService.name);

  /**
   * Match the canonical page URL shape used by the frontend.
   * Examples:
   *   /spaces/marketing/pages/9b4f1c2a-2d8a-4f7e-9aaa-1234567890ab
   *   https://wikso.example.com/spaces/eng/pages/9b4f...?focus=heading-1
   * The space slug is *not* captured — we resolve target pages by ID alone,
   * which lets us follow links across renamed spaces.
   */
  private static readonly PAGE_URL_RE =
    /\/spaces\/[^/\s]+\/pages\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  //   Extraction
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Recursively walks ProseMirror JSON and collects unique target page IDs:
   *   - any `link` mark whose href matches the canonical /spaces/.../pages/<id>
   *   - any `pageLink` / `pageMention` node carrying `attrs.pageId`
   * Self-references are filtered out.
   */
  extractTargetPageIds(contentJson: unknown, fromPageId: string): string[] {
    const found = new Set<string>();
    if (!contentJson || typeof contentJson !== 'object') return [];

    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;

      // 1) Custom node carrying a pageId attribute
      const attrs = n.attrs as Record<string, unknown> | undefined;
      if (attrs && typeof attrs.pageId === 'string' && this.isUuid(attrs.pageId)) {
        if (attrs.pageId !== fromPageId) found.add(attrs.pageId);
      }

      // 2) Standard ProseMirror link mark
      const marks = n.marks as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(marks)) {
        for (const m of marks) {
          if (m?.type === 'link') {
            const mAttrs = m.attrs as Record<string, unknown> | undefined;
            const href = mAttrs?.href;
            if (typeof href === 'string') {
              for (const id of this.parsePageIdsFromHref(href)) {
                if (id !== fromPageId) found.add(id);
              }
            }
          }
        }
      }

      const content = n.content as unknown;
      if (Array.isArray(content)) for (const child of content) visit(child);
    };

    visit(contentJson);
    return Array.from(found);
  }

  private parsePageIdsFromHref(href: string): string[] {
    PageLinksService.PAGE_URL_RE.lastIndex = 0;
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = PageLinksService.PAGE_URL_RE.exec(href)) !== null) {
      ids.push(m[1].toLowerCase());
    }
    return ids;
  }

  private isUuid(s: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //   Sync
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reconcile the PageLink rows for `fromPageId` against the links present in
   * `contentJson`. Replaces in a single transaction so the snapshot is
   * always consistent, even if multiple saves arrive in quick succession.
   * Errors are logged but never propagate — backlinks are a derived index,
   * losing one update should not block the user's save.
   */
  async syncLinksFromContent(fromPageId: string, contentJson: unknown): Promise<void> {
    try {
      const candidates = this.extractTargetPageIds(contentJson, fromPageId);

      // Validate that each target id corresponds to a real, non-deleted page.
      // This shields us from stale/pasted IDs and ensures we never insert a
      // dangling FK row (the FK would catch it too, but failing fast keeps the
      // transaction cleaner).
      let validIds: string[] = [];
      if (candidates.length > 0) {
        const rows = await this.prisma.page.findMany({
          where: { id: { in: candidates }, deletedAt: null },
          select: { id: true },
        });
        validIds = rows.map((r) => r.id);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.pageLink.deleteMany({ where: { fromPageId } });
        if (validIds.length === 0) return;
        await tx.pageLink.createMany({
          data: validIds.map((toPageId) => ({ fromPageId, toPageId })),
          skipDuplicates: true, // safety net for the unique([from,to]) constraint
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Backlink sync failed for page ${fromPageId}: ${msg}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //   Read API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns pages that link TO `pageId`, filtered to those the requester can
   * actually see. We trust the SpacePermissionGuard for the *target* page's
   * space (it's the URL slug), but we additionally check each *source*
   * page's space:
   *   - global ADMIN sees everything
   *   - PUBLIC source space → visible to any authenticated user
   *   - private source space → only if the user has an explicit permission
   *     (direct or via a group) or owns the space
   */
  async getBacklinks(
    pageId: string,
    slug: string,
    user: { id: string; role?: string },
  ) {
    // Confirm the target page exists in this space (IDOR defence — same
    // pattern as SharesService.assertPageInSpace).
    const target = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null, space: { slug } },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Page not found');

    const links = await this.prisma.pageLink.findMany({
      where: { toPageId: pageId, from: { deletedAt: null } },
      include: {
        from: {
          select: {
            id: true,
            title: true,
            slug: true,
            updatedAt: true,
            space: { select: { id: true, slug: true, name: true, type: true, ownerId: true } },
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (links.length === 0) return [];

    const isAdmin = user.role === 'ADMIN';
    const sourceSpaceIds = Array.from(new Set(links.map((l) => l.from.space.id)));

    let allowedSpaceIds = new Set<string>();
    if (isAdmin) {
      allowedSpaceIds = new Set(sourceSpaceIds);
    } else {
      // Owner-of OR public OR has explicit permission (direct or via group)
      const permRows = await this.prisma.spacePermission.findMany({
        where: {
          spaceId: { in: sourceSpaceIds },
          OR: [
            { userId: user.id },
            { group: { members: { some: { userId: user.id } } } },
          ],
        },
        select: { spaceId: true },
      });
      const permSet = new Set(permRows.map((p) => p.spaceId));
      for (const sid of sourceSpaceIds) {
        const sample = links.find((l) => l.from.space.id === sid)!;
        const space = sample.from.space;
        if (space.type === 'PUBLIC') allowedSpaceIds.add(sid);
        else if (space.ownerId === user.id) allowedSpaceIds.add(sid);
        else if (permSet.has(sid)) allowedSpaceIds.add(sid);
      }
    }

    return links
      .filter((l) => allowedSpaceIds.has(l.from.space.id))
      .map((l) => ({
        id: l.from.id,
        title: l.from.title,
        slug: l.from.slug,
        updatedAt: l.from.updatedAt,
        space: { slug: l.from.space.slug, name: l.from.space.name },
        author: l.from.author
          ? { id: l.from.author.id, name: l.from.author.name, avatarUrl: l.from.author.avatarUrl }
          : null,
        linkedAt: l.createdAt,
      }));
  }
}
