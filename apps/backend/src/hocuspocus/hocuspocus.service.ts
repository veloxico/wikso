import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as Y from 'yjs';
import { PageLinksService } from '../page-links/page-links.service';

/** Minimum interval between auto-created versions (in ms). */
const VERSION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Convert a Yjs XmlFragment (TipTap's internal storage) to
 * ProseMirror-compatible JSON that TipTap can render.
 */
function yXmlFragmentToJson(fragment: Y.XmlFragment): Record<string, unknown> {
  const content = fragment.toArray().flatMap((child) => yNodeToJson(child));
  return { type: 'doc', content: content.filter(Boolean) };
}

function yNodeToJson(node: unknown): any {
  if (node instanceof Y.XmlText) {
    const delta = node.toDelta();
    if (!delta || delta.length === 0) return [];
    return delta.map((op: any) => {
      const result: Record<string, unknown> = { type: 'text', text: op.insert };
      if (op.attributes && typeof op.attributes === 'object') {
        const marks = Object.entries(op.attributes)
          .filter(([, v]) => v !== null && v !== false)
          .map(([type, attrs]) => {
            const mark: Record<string, unknown> = { type };
            if (typeof attrs === 'object' && attrs !== null && Object.keys(attrs as object).length > 0) {
              mark.attrs = attrs;
            }
            return mark;
          });
        if (marks.length > 0) result.marks = marks;
      }
      return result;
    });
  }

  if (node instanceof Y.XmlElement) {
    const json: Record<string, unknown> = { type: node.nodeName };

    const attrs = node.getAttributes();
    if (attrs && Object.keys(attrs).length > 0) {
      json.attrs = attrs;
    }

    const children = node.toArray().flatMap((child) => yNodeToJson(child));
    if (children.length > 0) {
      json.content = children;
    }

    return json;
  }

  if (typeof node === 'string') {
    return { type: 'text', text: node };
  }

  return null;
}

@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private server: Server;
  private logger = new Logger(HocuspocusService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private pageLinks: PageLinksService,
  ) {}

  /**
   * Extract page ID from document name.
   * Supports formats: "page:<uuid>", "<uuid>", "page-<uuid>"
   */
  private extractPageId(documentName: string): string {
    if (documentName.startsWith('page:')) return documentName.slice(5);
    if (documentName.startsWith('page-')) return documentName.slice(5);
    return documentName;
  }

  async onModuleInit() {
    const port = parseInt(process.env.HOCUSPOCUS_PORT || '1234');

    this.server = new Server({
      port,
      extensions: [
        new Database({
          fetch: async ({ documentName }) => {
            const pageId = this.extractPageId(documentName);
            try {
              const page = await this.prisma.page.findUnique({
                where: { id: pageId },
                select: { yjsState: true, contentJson: true, deletedAt: true },
              });
              if (page?.deletedAt) return null;

              // Prefer persisted Y.js state
              if (page?.yjsState) {
                return new Uint8Array(page.yjsState);
              }

              // No yjsState yet (imported pages). Return null and let the
              // client load contentJson via API and initialize the editor
              // with its own ProseMirror schema. This avoids a lossy
              // server-side JSON→Y.js conversion that doesn't know
              // about the client's TipTap extensions and schema.
              return null;
            } catch (err) {
              this.logger.error(`Failed to fetch document ${pageId}: ${err.message}`);
              return null;
            }
          },
          store: async ({ documentName, state, document: ydoc }) => {
            const pageId = this.extractPageId(documentName);
            try {
              // Check if this page already has yjsState in DB.
              // Imported pages (yjsState = null) were loaded via setContent on
              // the client.  The ProseMirror→Y.js→ProseMirror round-trip through
              // the Hocuspocus sync protocol is lossy for complex table content,
              // so we NEVER persist yjsState for these pages.  On each page open
              // they will reload from the original contentJson and display correctly.
              const existing = await this.prisma.page.findUnique({
                where: { id: pageId },
                select: { yjsState: true, contentJson: true },
              });

              if (!existing?.yjsState) {
                this.logger.debug(
                  `Skipping Y.js persist for ${pageId} (imported page, no existing yjsState)`,
                );
                return;
              }

              // Page has existing yjsState (natively created/edited) — normal save flow.
              let contentJson: Record<string, unknown> | undefined;
              try {
                const fragment = (ydoc as Y.Doc).getXmlFragment('default');
                if (fragment.length > 0) {
                  contentJson = yXmlFragmentToJson(fragment);
                }
              } catch (convErr) {
                this.logger.warn(`Failed to convert Yjs→JSON for ${pageId}: ${convErr.message}`);
              }

              const buffer = Buffer.from(state);

              // Safety: don't overwrite contentJson with a dramatically smaller version.
              if (contentJson && existing.contentJson) {
                const existingLen = JSON.stringify(existing.contentJson).length;
                const newLen = JSON.stringify(contentJson).length;
                if (existingLen > 2000 && newLen < existingLen * 0.3) {
                  this.logger.warn(
                    `Skipping save for ${pageId}: ` +
                    `existing=${existingLen}, new=${newLen} (would lose content)`,
                  );
                  return;
                }
              }

              await this.prisma.page.update({
                where: { id: pageId },
                data: {
                  yjsState: buffer,
                  ...(contentJson ? { contentJson: contentJson as Prisma.InputJsonValue } : {}),
                },
              });

              // Create a version snapshot if enough time has passed
              if (contentJson) {
                await this.maybeCreateVersion(pageId, contentJson);
                // Reconcile backlink graph in the background — Yjs autosaves
                // fire often, so we never want to block a save on this.
                void this.pageLinks.syncLinksFromContent(pageId, contentJson);
              }
            } catch (err) {
              this.logger.error(`Failed to store document ${pageId}: ${err.message}`);
            }
          },
        }),
      ],
      onAuthenticate: async (data) => {
        const { token, documentName } = data;
        if (!token) {
          this.logger.warn('Hocuspocus connection without token — rejecting');
          throw new Error('Authentication required');
        }
        try {
          const cleanToken = token.toString().replace('Bearer ', '');
          const payload = this.jwtService.verify(cleanToken);

          // Verify user has access to this specific page
          const pageId = this.extractPageId(documentName);
          const page = await this.prisma.page.findUnique({
            where: { id: pageId },
            select: { id: true, spaceId: true, deletedAt: true },
          });
          if (!page || page.deletedAt) throw new Error('Page not found');

          // Check space access: public spaces are open; private/personal require membership
          const space = await this.prisma.space.findUnique({
            where: { id: page.spaceId },
            select: { type: true, ownerId: true },
          });
          if (!space) throw new Error('Space not found');

          if (space.type !== 'PUBLIC') {
            const isOwner = space.ownerId === payload.sub;
            const isAdmin = payload.role === 'ADMIN';
            const hasPerm = isOwner || isAdmin || await this.prisma.spacePermission.findFirst({
              where: { spaceId: page.spaceId, userId: payload.sub },
              select: { id: true },
            });
            if (!hasPerm) {
              this.logger.warn(`User ${payload.sub} denied WS access to page ${pageId}`);
              throw new Error('No access to this document');
            }
          }

          return { user: payload };
        } catch (err) {
          this.logger.warn(`Hocuspocus auth failed: ${err.message}`);
          throw new Error('Unauthorized');
        }
      },
    });

    await this.server.listen();
    this.logger.log(`Hocuspocus server listening on port ${port}`);
  }

  /**
   * Create a PageVersion only if the latest version for this page
   * is older than VERSION_INTERVAL_MS (5 min). Prevents flooding
   * the versions table on every Hocuspocus save cycle.
   */
  private async maybeCreateVersion(pageId: string, contentJson: Record<string, unknown>) {
    try {
      const latestVersion = await this.prisma.pageVersion.findFirst({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      const now = Date.now();
      const lastTime = latestVersion?.createdAt?.getTime() ?? 0;

      if (now - lastTime >= VERSION_INTERVAL_MS) {
        const page = await this.prisma.page.findUnique({
          where: { id: pageId },
          select: { authorId: true },
        });

        // authorId must reference a valid User — skip if page has no author
        if (!page?.authorId) {
          this.logger.warn(`Skipping auto-version for ${pageId}: no authorId`);
          return;
        }

        await this.prisma.pageVersion.create({
          data: {
            pageId,
            contentJson: contentJson as Prisma.InputJsonValue,
            authorId: page.authorId,
          },
        });

        this.logger.debug(`Created auto-version for page ${pageId}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to create auto-version for ${pageId}: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.server.destroy();
  }
}
