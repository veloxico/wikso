import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: {
    space: { findUnique: jest.Mock };
    tag: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
    page: { findUnique: jest.Mock; findMany: jest.Mock };
    pageTag: { create: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      space: { findUnique: jest.fn() },
      tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      page: { findUnique: jest.fn(), findMany: jest.fn() },
      pageTag: { create: jest.fn(), deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    it('should return tags for a space', async () => {
      const space = { id: 'space-1', slug: 'engineering' };
      const tags = [
        { id: 'tag-1', name: 'frontend', spaceId: 'space-1', _count: { pages: 3 } },
        { id: 'tag-2', name: 'backend', spaceId: 'space-1', _count: { pages: 5 } },
      ];

      prisma.space.findUnique.mockResolvedValue(space);
      prisma.tag.findMany.mockResolvedValue(tags);

      const result = await service.list('engineering');

      expect(result).toEqual(tags);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1' },
        include: { _count: { select: { pages: true } } },
        orderBy: { name: 'asc' },
      });
    });

    it('should throw NotFoundException for unknown space', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.list('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a tag with lowercase trimmed name', async () => {
      const space = { id: 'space-1' };
      const tag = { id: 'tag-1', name: 'frontend', spaceId: 'space-1' };

      prisma.space.findUnique.mockResolvedValue(space);
      prisma.tag.create.mockResolvedValue(tag);

      const result = await service.create('engineering', '  Frontend  ');

      expect(result).toEqual(tag);
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: { name: 'frontend', spaceId: 'space-1' },
      });
    });

    it('should throw ConflictException on duplicate tag', async () => {
      const space = { id: 'space-1' };
      prisma.space.findUnique.mockResolvedValue(space);
      prisma.tag.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create('engineering', 'frontend')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException for unknown space', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.create('nonexistent', 'tag')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------
  describe('delete', () => {
    it('should delete a tag', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      prisma.tag.delete.mockResolvedValue({});

      const result = await service.delete('tag-1');

      expect(result).toEqual({ message: 'Tag deleted' });
    });

    it('should throw NotFoundException for unknown tag', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // addTagToPage
  // ---------------------------------------------------------------------------
  describe('addTagToPage', () => {
    it('should add a tag to a page', async () => {
      prisma.page.findUnique.mockResolvedValue({ id: 'page-1', deletedAt: null });
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      prisma.pageTag.create.mockResolvedValue({});

      const result = await service.addTagToPage('page-1', 'tag-1');

      expect(result).toEqual({ message: 'Tag added' });
    });

    it('should return idempotent message on duplicate', async () => {
      prisma.page.findUnique.mockResolvedValue({ id: 'page-1', deletedAt: null });
      prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      prisma.pageTag.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.addTagToPage('page-1', 'tag-1');

      expect(result).toEqual({ message: 'Tag already added' });
    });

    it('should throw NotFoundException for deleted page', async () => {
      prisma.page.findUnique.mockResolvedValue({ id: 'page-1', deletedAt: new Date() });

      await expect(service.addTagToPage('page-1', 'tag-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for unknown page', async () => {
      prisma.page.findUnique.mockResolvedValue(null);

      await expect(service.addTagToPage('nonexistent', 'tag-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for unknown tag', async () => {
      prisma.page.findUnique.mockResolvedValue({ id: 'page-1', deletedAt: null });
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.addTagToPage('page-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // removeTagFromPage
  // ---------------------------------------------------------------------------
  describe('removeTagFromPage', () => {
    it('should remove a tag from a page', async () => {
      prisma.pageTag.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeTagFromPage('page-1', 'tag-1');

      expect(result).toEqual({ message: 'Tag removed' });
      expect(prisma.pageTag.deleteMany).toHaveBeenCalledWith({
        where: { pageId: 'page-1', tagId: 'tag-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPagesByTag
  // ---------------------------------------------------------------------------
  describe('getPagesByTag', () => {
    it('should return pages with a specific tag', async () => {
      const space = { id: 'space-1' };
      const pages = [
        { id: 'page-1', title: 'Page 1', tags: [{ tag: { id: 'tag-1', name: 'frontend' } }] },
      ];

      prisma.space.findUnique.mockResolvedValue(space);
      prisma.page.findMany.mockResolvedValue(pages);

      const result = await service.getPagesByTag('engineering', 'tag-1');

      expect(result).toEqual(pages);
      expect(prisma.page.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          deletedAt: null,
          tags: { some: { tagId: 'tag-1' } },
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should throw NotFoundException for unknown space', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.getPagesByTag('nonexistent', 'tag-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
