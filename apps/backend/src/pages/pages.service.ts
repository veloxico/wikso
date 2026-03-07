import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

@Injectable()
export class PagesService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async create(spaceSlug: string, dto: CreatePageDto, authorId: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    const slug = slugify(dto.title) + '-' + Date.now().toString(36);
    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        slug,
        contentJson: dto.contentJson || {},
        parentId: dto.parentId,
        status: dto.status || 'DRAFT',
        spaceId: space.id,
        authorId,
      },
    });

    // Create initial version
    await this.prisma.pageVersion.create({
      data: { pageId: page.id, contentJson: page.contentJson || {}, authorId },
    });

    // Index in search
    await this.searchService.indexPage(page);

    return page;
  }

  async getTree(spaceSlug: string) {
    const space = await this.prisma.space.findUnique({ where: { slug: spaceSlug } });
    if (!space) throw new NotFoundException('Space not found');

    const pages: any[] = await this.prisma.$queryRaw`
      WITH RECURSIVE page_tree AS (
        SELECT id, title, slug, "parentId", position, status, "authorId", "createdAt", "updatedAt", 0 as depth
        FROM "Page"
        WHERE "spaceId" = ${space.id} AND "parentId" IS NULL
        UNION ALL
        SELECT p.id, p.title, p.slug, p."parentId", p.position, p.status, p."authorId", p."createdAt", p."updatedAt", pt.depth + 1
        FROM "Page" p
        INNER JOIN page_tree pt ON p."parentId" = pt.id
      )
      SELECT * FROM page_tree ORDER BY depth, position
    `;

    return this.buildTree(pages);
  }

  private buildTree(pages: any[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const page of pages) {
      map.set(page.id, { ...page, children: [] });
    }

    for (const page of pages) {
      const node = map.get(page.id);
      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findById(pageId: string) {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async update(pageId: string, dto: UpdatePageDto, userId: string) {
    const page = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.contentJson !== undefined && { contentJson: dto.contentJson }),
        ...(dto.status && { status: dto.status }),
      },
    });

    if (dto.contentJson !== undefined) {
      await this.prisma.pageVersion.create({
        data: { pageId, contentJson: dto.contentJson, authorId: userId },
      });
    }

    await this.searchService.indexPage(page);
    return page;
  }

  async delete(pageId: string) {
    await this.searchService.removePage(pageId);
    await this.prisma.page.delete({ where: { id: pageId } });
    return { message: 'Page deleted' };
  }

  async move(pageId: string, dto: MovePageDto) {
    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });
  }

  async getVersions(pageId: string) {
    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVersion(pageId: string, versionId: string) {
    const version = await this.prisma.pageVersion.findFirst({
      where: { id: versionId, pageId },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }
}
