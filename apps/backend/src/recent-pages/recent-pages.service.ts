import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecentPagesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, limit = 20) {
    return this.prisma.recentPage.findMany({
      where: { userId },
      orderBy: { visitedAt: 'desc' },
      take: limit,
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            space: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async recordVisit(userId: string, pageId: string) {
    // Track in recent pages
    const result = await this.prisma.recentPage.upsert({
      where: {
        userId_pageId: { userId, pageId },
      },
      update: {
        visitedAt: new Date(),
      },
      create: {
        userId,
        pageId,
        visitedAt: new Date(),
      },
    });

    // Also record a page view for analytics
    try {
      await this.prisma.pageView.create({
        data: { pageId, userId },
      });
    } catch {
      // Non-critical — don't break the main flow
    }

    return result;
  }
}
