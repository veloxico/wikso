import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as Y from 'yjs';

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
                select: { yjsState: true },
              });
              if (page?.yjsState) {
                return new Uint8Array(page.yjsState);
              }
              return null;
            } catch (err) {
              this.logger.error(`Failed to fetch document ${pageId}: ${err.message}`);
              return null;
            }
          },
          store: async ({ documentName, state, document: ydoc }) => {
            const pageId = this.extractPageId(documentName);
            try {
              // 1. Convert Yjs XmlFragment → TipTap/ProseMirror JSON
              let contentJson: Record<string, unknown> | undefined;
              try {
                const fragment = (ydoc as Y.Doc).getXmlFragment('default');
                if (fragment.length > 0) {
                  contentJson = yXmlFragmentToJson(fragment);
                }
              } catch (convErr) {
                this.logger.warn(`Failed to convert Yjs→JSON for ${pageId}: ${convErr.message}`);
              }

              // 2. Persist both yjsState and contentJson
              const buffer = Buffer.from(state);
              await this.prisma.page.update({
                where: { id: pageId },
                data: {
                  yjsState: buffer,
                  ...(contentJson ? { contentJson: contentJson as Prisma.InputJsonValue } : {}),
                },
              });

              // 3. Create a version snapshot if enough time has passed
              if (contentJson) {
                await this.maybeCreateVersion(pageId, contentJson);
              }
            } catch (err) {
              this.logger.error(`Failed to store document ${pageId}: ${err.message}`);
            }
          },
        }),
      ],
      onAuthenticate: async (data) => {
        const { token } = data;
        if (!token) {
          this.logger.warn('Hocuspocus connection without token');
          return { user: null };
        }
        try {
          const cleanToken = token.toString().replace('Bearer ', '');
          const payload = this.jwtService.verify(cleanToken);
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

        await this.prisma.pageVersion.create({
          data: {
            pageId,
            contentJson: contentJson as Prisma.InputJsonValue,
            authorId: page?.authorId || 'system',
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
