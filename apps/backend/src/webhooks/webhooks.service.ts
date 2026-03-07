import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  private logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWebhookDto, userId: string) {
    return this.prisma.webhook.create({
      data: { ...dto, userId },
    });
  }

  async findAll(userId: string) {
    return this.prisma.webhook.findMany({ where: { userId } });
  }

  async delete(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
    return { message: 'Webhook deleted' };
  }

  async fireEvent(event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { events: { has: event } },
    });

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret && { 'X-Webhook-Secret': webhook.secret }),
          },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
        });
      } catch (err) {
        this.logger.warn(`Webhook ${webhook.id} failed: ${err.message}`);
      }
    }
  }
}
