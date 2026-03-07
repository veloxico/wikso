import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

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
          store: async ({ documentName, state }) => {
            const pageId = this.extractPageId(documentName);
            try {
              const buffer = Buffer.from(state);
              await this.prisma.page.update({
                where: { id: pageId },
                data: { yjsState: buffer },
              });
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
          // Allow connection but mark as unauthenticated
          // In production, uncomment the throw to enforce auth:
          // throw new Error('Authentication required');
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

  async onModuleDestroy() {
    await this.server.destroy();
  }
}
