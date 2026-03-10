import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private logger = new Logger(SearchService.name);
  private readonly indexName = 'pages';

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue('search-index') private searchQueue?: Queue,
  ) {
    this.client = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_API_KEY || 'masterKey',
    });
  }

  async onModuleInit() {
    try {
      let index = this.client.index(this.indexName);
      try {
        await this.client.getIndex(this.indexName);
      } catch {
        await this.client.createIndex(this.indexName, { primaryKey: 'id' });
        index = this.client.index(this.indexName);
      }

      await index.updateFilterableAttributes(['spaceId', 'authorId', 'tags', 'status']);
      await index.updateSearchableAttributes(['title', 'content']);
    } catch (err) {
      this.logger.warn(`Meilisearch init failed: ${err.message}`);
    }
  }

  async indexPage(page: any, space?: { slug: string; name: string }) {
    const content = typeof page.contentJson === 'object'
      ? JSON.stringify(page.contentJson)
      : String(page.contentJson || '');

    const document = {
      id: page.id,
      title: page.title,
      content,
      spaceId: page.spaceId,
      spaceSlug: space?.slug || '',
      spaceName: space?.name || '',
      authorId: page.authorId,
      status: page.status,
      slug: page.slug,
      createdAt: page.createdAt?.toISOString?.() || page.createdAt,
      updatedAt: page.updatedAt?.toISOString?.() || page.updatedAt,
    };

    // If BullMQ queue is available, enqueue for async processing
    if (this.searchQueue) {
      try {
        await this.searchQueue.add('index', {
          action: 'index',
          pageId: page.id,
          document,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue search index for page ${page.id}: ${err.message}`);
        // Fall through to synchronous indexing
      }
    }

    // Fallback: index synchronously
    try {
      const index = this.client.index(this.indexName);
      await index.addDocuments([document], { primaryKey: 'id' })
        .then((t: any) => t.waitTask?.({ timeout: 5000 }).catch(() => {}));
    } catch (err) {
      this.logger.warn(`Failed to index page ${page.id}: ${err.message}`);
    }
  }

  async removePage(pageId: string) {
    // If BullMQ queue is available, enqueue for async processing
    if (this.searchQueue) {
      try {
        await this.searchQueue.add('remove', {
          action: 'remove',
          pageId,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        });
        return;
      } catch (err) {
        this.logger.warn(`Failed to enqueue search removal for page ${pageId}: ${err.message}`);
        // Fall through to synchronous removal
      }
    }

    // Fallback: remove synchronously
    try {
      const index = this.client.index(this.indexName);
      await index.deleteDocument(pageId);
    } catch (err) {
      this.logger.warn(`Failed to remove page ${pageId}: ${err.message}`);
    }
  }

  async searchGlobal(query: string, userId: string) {
    const [pageResults, spaces] = await Promise.all([
      // Pages via MeiliSearch (top 5 for quick results)
      this.client
        .index(this.indexName)
        .search(query, { limit: 5 })
        .catch(() => ({ hits: [] as any[] })),

      // Spaces via Prisma (ILIKE on name)
      this.prisma.space.findMany({
        where: {
          name: { contains: query, mode: 'insensitive' as const },
          OR: [
            { type: 'PUBLIC' },
            { ownerId: userId },
            { permissions: { some: { userId } } },
          ],
        },
        select: { id: true, name: true, slug: true, type: true },
        take: 5,
      }),
    ]);

    return {
      pages: pageResults.hits.map((h: any) => ({
        id: h.id,
        title: h.title,
        slug: h.slug,
        spaceId: h.spaceId,
        spaceName: h.spaceName,
        spaceSlug: h.spaceSlug,
        excerpt: h._formatted?.content?.substring(0, 120) || '',
        updatedAt: h.updatedAt,
      })),
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        type: s.type,
      })),
    };
  }

  async reindexAll() {
    const index = this.client.index(this.indexName);

    // Clear existing index
    const clearPromise = index.deleteAllDocuments();
    await clearPromise.waitTask({ timeout: 30_000 }).catch(() => {});

    // Fetch all non-deleted pages with their spaces
    const pages = await this.prisma.page.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        contentJson: true,
        spaceId: true,
        authorId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        space: { select: { slug: true, name: true } },
      },
    });

    if (pages.length === 0) {
      return { indexed: 0 };
    }

    // Build documents in batches of 500
    const batchSize = 500;
    let indexed = 0;

    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      const documents = batch.map((page) => {
        const content = typeof page.contentJson === 'object'
          ? JSON.stringify(page.contentJson)
          : String(page.contentJson || '');

        return {
          id: page.id,
          title: page.title,
          content,
          spaceId: page.spaceId,
          spaceSlug: page.space?.slug || '',
          spaceName: page.space?.name || '',
          authorId: page.authorId,
          status: page.status,
          slug: page.slug,
          createdAt: page.createdAt?.toISOString?.() || page.createdAt,
          updatedAt: page.updatedAt?.toISOString?.() || page.updatedAt,
        };
      });

      const addPromise = index.addDocuments(documents, { primaryKey: 'id' });
      await addPromise.waitTask({ timeout: 60_000 }).catch(() => {});
      indexed += batch.length;
      this.logger.log(`Reindex progress: ${indexed}/${pages.length}`);
    }

    this.logger.log(`Reindex complete: ${indexed} pages indexed`);
    return { indexed };
  }

  async search(query: string, filters?: { spaceId?: string; authorId?: string; tags?: string }) {
    try {
      const index = this.client.index(this.indexName);
      const filterParts: string[] = [];

      if (filters?.spaceId) filterParts.push(`spaceId = "${filters.spaceId}"`);
      if (filters?.authorId) filterParts.push(`authorId = "${filters.authorId}"`);

      return index.search(query, {
        filter: filterParts.length ? filterParts.join(' AND ') : undefined,
        limit: 50,
      });
    } catch (err) {
      this.logger.warn(`Search failed: ${err.message}`);
      return { hits: [], query };
    }
  }
}
