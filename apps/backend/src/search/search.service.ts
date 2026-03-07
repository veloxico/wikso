import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private logger = new Logger(SearchService.name);
  private readonly indexName = 'pages';

  constructor() {
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

  async indexPage(page: any) {
    try {
      const index = this.client.index(this.indexName);
      const content = typeof page.contentJson === 'object'
        ? JSON.stringify(page.contentJson)
        : String(page.contentJson || '');

      await index.addDocuments([
        {
          id: page.id,
          title: page.title,
          content,
          spaceId: page.spaceId,
          authorId: page.authorId,
          status: page.status,
          slug: page.slug,
          createdAt: page.createdAt?.toISOString?.() || page.createdAt,
          updatedAt: page.updatedAt?.toISOString?.() || page.updatedAt,
        },
      ], { primaryKey: 'id' }).then((t: any) => t.waitTask?.({ timeout: 5000 }).catch(() => {}));
    } catch (err) {
      this.logger.warn(`Failed to index page ${page.id}: ${err.message}`);
    }
  }

  async removePage(pageId: string) {
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
