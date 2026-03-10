import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImportService, ImportProgress } from '../import.service';

interface ImportJobData {
  zipPath: string;
  adminUserId: string;
}

@Processor('confluence-import')
export class ImportProcessor extends WorkerHost {
  private logger = new Logger(ImportProcessor.name);

  constructor(private importService: ImportService) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<ImportProgress> {
    const { zipPath, adminUserId } = job.data;

    this.logger.log(`Starting Confluence import job ${job.id} for admin ${adminUserId}`);

    const result = await this.importService.processImport(
      zipPath,
      adminUserId,
      async (progress: ImportProgress) => {
        try {
          await job.updateProgress(progress);
        } catch {
          // Ignore progress update errors
        }
      },
    );

    if (result.phase === 'error') {
      this.logger.error(`Import job ${job.id} failed: ${result.message}`);
      throw new Error(result.message);
    }

    this.logger.log(
      `Import job ${job.id} completed: ${result.counts.spaces} spaces, ` +
      `${result.counts.pages} pages, ${result.counts.attachments} attachments, ` +
      `${result.counts.comments} comments, ${result.counts.tags} tags`,
    );

    return result;
  }
}
