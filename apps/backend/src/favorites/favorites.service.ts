import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId, page: { deletedAt: null } },
      include: {
        page: {
          include: {
            space: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggle(userId: string, pageId: string): Promise<{ isFavorite: boolean }> {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_pageId: { userId, pageId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });
      return { isFavorite: false };
    }

    try {
      await this.prisma.favorite.create({
        data: { userId, pageId },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation — another concurrent request already created it.
      // Treat as already-favorited rather than crashing.
      if (err?.code === 'P2002') {
        return { isFavorite: true };
      }
      throw err;
    }
    return { isFavorite: true };
  }

  async remove(userId: string, pageId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, pageId },
    });
    return { message: 'Favorite removed' };
  }

  async check(userId: string, pageId: string): Promise<{ isFavorite: boolean }> {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_pageId: { userId, pageId } },
    });
    return { isFavorite: !!favorite };
  }
}
