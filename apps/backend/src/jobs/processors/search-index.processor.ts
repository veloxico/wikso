import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MeiliSearch } from 'meilisearch';

interface IndexJobData {
  action: 'index' | 'remove';
  pageId: string;
  document?: {
    id: string;
    title: string;
    content: string;
    spaceId: string;
    spaceSlug: string;
    spaceName: string;
    authorId: string;
    status: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
}

@Processor('search-index')
export class SearchIndexProcessor extends WorkerHost {
  private logger = new Logger(SearchIndexProcessor.name);
  private client: MeiliSearch;
  private readonly indexName = 'pages';

  constructor() {
    super();
    this.client = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_API_KEY || 'masterKey',
    });
  }

  async process(job: Job<IndexJobData>): Promise<void> {
    const { action, pageId, document } = job.data;

    try {
      const index = this.client.index(this.indexName);

      if (action === 'remove') {
        await index.deleteDocument(pageId);
        return;
      }

      if (action === 'index' && document) {
        await index
          .addDocuments([document], { primaryKey: 'id' })
          .then((t: any) => t.waitTask?.({ timeout: 5000 }).catch(() => {}));
      }
    } catch (err) {
      this.logger.warn(`Search index job failed for page ${pageId}: ${err.message}`);
      throw err; // Let BullMQ retry
    }
  }
}
