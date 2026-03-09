import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /** List all tags in a space */
  async list(spaceSlug: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    return this.prisma.tag.findMany({
      where: { spaceId: space.id },
      include: { _count: { select: { pages: true } } },
      orderBy: { name: 'asc' },
    });
  }

  /** Create a new tag in a space */
  async create(spaceSlug: string, name: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    try {
      return await this.prisma.tag.create({
        data: { name: name.trim().toLowerCase(), spaceId: space.id },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Tag already exists in this space');
      }
      throw err;
    }
  }

  /** Delete a tag */
  async delete(tagId: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.tag.delete({ where: { id: tagId } });
    return { message: 'Tag deleted' };
  }

  /** Add a tag to a page */
  async addTagToPage(pageId: string, tagId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.deletedAt) throw new NotFoundException('Page not found');

    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');

    try {
      await this.prisma.pageTag.create({
        data: { pageId, tagId },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Already tagged — idempotent
        return { message: 'Tag already added' };
      }
      throw err;
    }

    return { message: 'Tag added' };
  }

  /** Remove a tag from a page */
  async removeTagFromPage(pageId: string, tagId: string) {
    await this.prisma.pageTag.deleteMany({
      where: { pageId, tagId },
    });
    return { message: 'Tag removed' };
  }

  /** Get pages by tag */
  async getPagesByTag(spaceSlug: string, tagId: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    return this.prisma.page.findMany({
      where: {
        spaceId: space.id,
        deletedAt: null,
        tags: { some: { tagId } },
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
