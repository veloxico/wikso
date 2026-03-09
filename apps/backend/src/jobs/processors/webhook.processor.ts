import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

interface WebhookJobData {
  webhookId: string;
  url: string;
  secret?: string;
  event: string;
  payload: any;
}

@Processor('webhooks')
export class WebhookProcessor extends WorkerHost {
  private logger = new Logger(WebhookProcessor.name);

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { webhookId, url, secret, event, payload } = job.data;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret && { 'X-Webhook-Secret': secret }),
        },
        body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `Webhook ${webhookId} returned ${response.status} for event ${event}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Webhook ${webhookId} failed: ${err.message}`);
      throw err; // Let BullMQ retry
    }
  }
}
