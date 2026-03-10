import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

/** Block private/internal IPs to prevent SSRF attacks. */
function isPublicUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname;
    // Block obvious private ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class WebhooksService {
  private logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue('webhooks') private webhooksQueue?: Queue,
  ) {}

  async create(dto: CreateWebhookDto, userId: string) {
    if (!isPublicUrl(dto.url)) {
      throw new BadRequestException('Webhook URL must be a public HTTP(S) URL');
    }

    return this.prisma.webhook.create({
      data: { ...dto, userId },
    });
  }

  async findAll(userId: string) {
    return this.prisma.webhook.findMany({ where: { userId } });
  }

  async delete(id: string, userId: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.userId !== userId) throw new ForbiddenException('You can only delete your own webhooks');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  async fireEvent(event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { events: { has: event }, active: true },
    });

    for (const webhook of webhooks) {
      // Skip webhooks with private/internal URLs
      if (!isPublicUrl(webhook.url)) {
        this.logger.warn(`Webhook ${webhook.id} skipped: private URL ${webhook.url}`);
        continue;
      }

      // If BullMQ queue is available, enqueue for async processing
      if (this.webhooksQueue) {
        try {
          await this.webhooksQueue.add('deliver', {
            webhookId: webhook.id,
            url: webhook.url,
            secret: webhook.secret,
            event,
            payload,
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          });
        } catch (err) {
          this.logger.warn(`Failed to enqueue webhook ${webhook.id}: ${err.message}`);
        }
        continue;
      }

      // Fallback: fire synchronously
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret && { 'X-Webhook-Secret': webhook.secret }),
          },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (err) {
        this.logger.warn(`Webhook ${webhook.id} failed: ${err.message}`);
      }
    }
  }
}
