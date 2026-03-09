import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MeiliSearch } from 'meilisearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private logger = new Logger(SearchService.name);
  private readonly indexName = 'pages';

  constructor(
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
