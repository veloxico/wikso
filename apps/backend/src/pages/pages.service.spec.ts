import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';

describe('PagesService', () => {
  let service: PagesService;
  let prisma: PrismaService;
  let searchService: SearchService;
  let notificationsService: NotificationsService;
  let webhooksService: WebhooksService;

  const mockSpace = {
    id: 'space-1',
    name: 'Test Space',
    slug: 'test-space',
  };

  const mockAuthor = {
    id: 'user-1',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
  };

  const mockPage = {
    id: 'page-1',
    title: 'Test Page',
    slug: 'test-page-abc123',
    contentJson: { type: 'doc', content: [] },
    parentId: null,
    status: 'DRAFT',
    spaceId: 'space-1',
    authorId: 'user-1',
    position: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockPageWithRelations = {
    ...mockPage,
    author: mockAuthor,
    tags: [],
  };

  const mockPageWithSpace = {
    ...mockPage,
    space: mockSpace,
  };

  const mockVersion = {
    id: 'version-1',
    pageId: 'page-1',
    contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    authorId: 'user-1',
    createdAt: new Date('2025-01-01'),
  };

  const mockSpaceMembers = [
    { userId: 'user-1' },
    { userId: 'user-2' },
    { userId: 'user-3' },
  ];

  const mockPrisma = {
    space: {
      findUnique: jest.fn(),
    },
    page: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    pageVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    spacePermission: {
      findMany: jest.fn(),
    },
    pageTag: {
      createMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockSearchService = {
    indexPage: jest.fn(),
    removePage: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  const mockWebhooksService = {
    fireEvent: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: SearchService, useValue: mockSearchService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: WebhooksService, useValue: mockWebhooksService },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    prisma = module.get<PrismaService>(PrismaService);
    searchService = module.get<SearchService>(SearchService);
    notificationsService = module.get<NotificationsService>(
      NotificationsService,
    );
    webhooksService = module.get<WebhooksService>(WebhooksService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a page with version, index it, notify members, and fire webhook', async () => {
      const dto = {
        title: 'My New Page',
        contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      };

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.page.create.mockResolvedValue({
        ...mockPage,
        title: dto.title,
        contentJson: dto.contentJson,
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue(mockSpaceMembers);
      mockNotificationsService.create.mockResolvedValue(undefined);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.create('test-space', dto, 'user-1');

      // Verifies space lookup
      expect(mockPrisma.space.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-space' },
      });

      // Verifies page creation with correct data
      expect(mockPrisma.page.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: dto.title,
          contentJson: dto.contentJson,
          spaceId: mockSpace.id,
          authorId: 'user-1',
          status: 'DRAFT',
        }),
      });

      // Slug should be present and based on the title
      const createCall = mockPrisma.page.create.mock.calls[0][0];
      expect(createCall.data.slug).toMatch(/^my-new-page-/);

      // Verifies initial version creation
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: mockPage.id,
          contentJson: dto.contentJson,
          authorId: 'user-1',
        },
      });

      // Verifies search indexing
      expect(mockSearchService.indexPage).toHaveBeenCalledWith(
        expect.objectContaining({ title: dto.title }),
        { slug: 'test-space', name: mockSpace.name },
      );

      // Verifies space members were queried for notifications
      expect(mockPrisma.spacePermission.findMany).toHaveBeenCalledWith({
        where: { spaceId: mockSpace.id },
        select: { userId: true },
      });

      // Verifies notifications were sent to other members (not the author)
      expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'user-2',
        'page.created',
        expect.objectContaining({
          pageId: mockPage.id,
          pageTitle: dto.title,
          spaceSlug: 'test-space',
          spaceName: mockSpace.name,
        }),
      );
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'user-3',
        'page.created',
        expect.objectContaining({ pageId: mockPage.id }),
      );

      // Verifies webhook was fired
      expect(mockWebhooksService.fireEvent).toHaveBeenCalledWith(
        'page.created',
        expect.objectContaining({
          pageId: mockPage.id,
          title: dto.title,
          spaceSlug: 'test-space',
          authorId: 'user-1',
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({ title: dto.title }),
      );
    });

    it('should use default empty contentJson and DRAFT status when not provided', async () => {
      const dto = { title: 'Minimal Page' };

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.page.create.mockResolvedValue({
        ...mockPage,
        title: dto.title,
        contentJson: {},
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue([]);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      await service.create('test-space', dto, 'user-1');

      const createCall = mockPrisma.page.create.mock.calls[0][0];
      expect(createCall.data.contentJson).toEqual({});
      expect(createCall.data.status).toBe('DRAFT');
    });

    it('should throw NotFoundException when space is not found', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent-space', { title: 'Test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.page.create).not.toHaveBeenCalled();
      expect(mockSearchService.indexPage).not.toHaveBeenCalled();
      expect(mockWebhooksService.fireEvent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getTree
  // ---------------------------------------------------------------------------
  describe('getTree', () => {
    it('should throw NotFoundException when space is not found', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(null);

      await expect(service.getTree('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return a tree structure built from flat pages', async () => {
      const flatPages = [
        { id: 'p1', title: 'Root', parentId: null, position: 0, depth: 0 },
        { id: 'p2', title: 'Child', parentId: 'p1', position: 0, depth: 1 },
        {
          id: 'p3',
          title: 'Grandchild',
          parentId: 'p2',
          position: 0,
          depth: 2,
        },
      ];

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.$queryRaw.mockResolvedValue(flatPages);

      const result = await service.getTree('test-space');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('p2');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].id).toBe('p3');
    });

    it('should handle multiple root pages', async () => {
      const flatPages = [
        { id: 'p1', title: 'Root 1', parentId: null, position: 0, depth: 0 },
        { id: 'p2', title: 'Root 2', parentId: null, position: 1, depth: 0 },
      ];

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.$queryRaw.mockResolvedValue(flatPages);

      const result = await service.getTree('test-space');

      expect(result).toHaveLength(2);
      expect(result[0].children).toHaveLength(0);
      expect(result[1].children).toHaveLength(0);
    });

    it('should return an empty array when space has no pages', async () => {
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getTree('test-space');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe('findById', () => {
    it('should return a page with author and tags when found', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithRelations);

      const result = await service.findById('page-1');

      expect(mockPrisma.page.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          tags: { include: { tag: true } },
        },
      });
      expect(result).toEqual(mockPageWithRelations);
    });

    it('should throw NotFoundException when page is not found', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent-page')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update a page and create a new version when contentJson is provided', async () => {
      const dto = {
        title: 'Updated Title',
        contentJson: { type: 'doc', content: [{ type: 'heading' }] },
      };

      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPageWithSpace,
        title: dto.title,
        contentJson: dto.contentJson,
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue(mockSpaceMembers);
      mockNotificationsService.create.mockResolvedValue(undefined);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.update('page-1', dto, 'user-1');

      // Verifies page was updated with correct data
      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          title: dto.title,
          contentJson: dto.contentJson,
        },
        include: { space: true },
      });

      // Verifies a new version was created
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          contentJson: dto.contentJson,
          authorId: 'user-1',
        },
      });

      // Verifies search was re-indexed
      expect(mockSearchService.indexPage).toHaveBeenCalled();

      // Verifies notifications were sent
      expect(mockNotificationsService.create).toHaveBeenCalled();

      // Verifies webhook was fired
      expect(mockWebhooksService.fireEvent).toHaveBeenCalledWith(
        'page.updated',
        expect.objectContaining({
          pageId: mockPage.id,
          title: dto.title,
          updatedBy: 'user-1',
        }),
      );

      expect(result.title).toBe(dto.title);
    });

    it('should not create a version when contentJson is not provided', async () => {
      const dto = { title: 'Only Title Changed' };

      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPageWithSpace,
        title: dto.title,
      });
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue([]);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      await service.update('page-1', dto, 'user-1');

      expect(mockPrisma.pageVersion.create).not.toHaveBeenCalled();
    });

    it('should create a version when contentJson is explicitly set to an empty object', async () => {
      const dto = { contentJson: {} };

      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPageWithSpace,
        contentJson: {},
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue([]);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      await service.update('page-1', dto, 'user-1');

      // contentJson is defined (even though it is {}), so a version should be created
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          contentJson: {},
          authorId: 'user-1',
        },
      });
    });

    it('should skip notifications when page has no space', async () => {
      const dto = { title: 'No Space Page' };

      mockPrisma.page.findUnique.mockResolvedValue(mockPage);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPage,
        space: null,
        title: dto.title,
      });
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      await service.update('page-1', dto, 'user-1');

      expect(mockPrisma.spacePermission.findMany).not.toHaveBeenCalled();
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------
  describe('delete', () => {
    it('should soft-delete the page, children, remove from search, and fire webhook', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.update.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.updateMany.mockResolvedValue({ count: 0 });
      mockSearchService.removePage.mockResolvedValue(undefined);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.delete('page-1', 'user-1');

      // Verifies page lookup with space
      expect(mockPrisma.page.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        include: { space: true },
      });

      // Verifies soft-delete (update, not delete)
      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: expect.objectContaining({ deletedBy: 'user-1' }),
      });

      // Verifies children soft-delete
      expect(mockPrisma.page.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'page-1', deletedAt: null },
        data: expect.objectContaining({ deletedBy: 'user-1' }),
      });

      // Verifies search removal
      expect(mockSearchService.removePage).toHaveBeenCalledWith('page-1');

      // Verifies webhook was fired
      expect(mockWebhooksService.fireEvent).toHaveBeenCalledWith(
        'page.deleted',
        expect.objectContaining({
          pageId: 'page-1',
          title: mockPage.title,
        }),
      );

      expect(result).toEqual({ message: 'Page moved to trash' });
    });

    it('should throw NotFoundException when page is not found', async () => {
      mockPrisma.page.findUnique.mockResolvedValue(null);

      await expect(service.delete('page-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.page.update).not.toHaveBeenCalled();
      expect(mockSearchService.removePage).not.toHaveBeenCalled();
      expect(mockWebhooksService.fireEvent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // move
  // ---------------------------------------------------------------------------
  describe('move', () => {
    it('should update parentId and position', async () => {
      const dto = { parentId: 'new-parent', position: 3 };

      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPage,
        parentId: dto.parentId,
        position: dto.position,
      });

      const result = await service.move('page-1', dto);

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          parentId: dto.parentId,
          position: dto.position,
        },
      });
      expect(result.parentId).toBe('new-parent');
      expect(result.position).toBe(3);
    });

    it('should update only parentId when position is not provided', async () => {
      const dto = { parentId: 'new-parent' };

      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPage,
        parentId: 'new-parent',
      });

      await service.move('page-1', dto);

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { parentId: 'new-parent' },
      });
    });

    it('should update only position when parentId is not provided', async () => {
      const dto = { position: 5 };

      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPage,
        position: 5,
      });

      await service.move('page-1', dto);

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { position: 5 },
      });
    });

    it('should allow setting parentId to null to move page to root', async () => {
      const dto = { parentId: null };

      mockPrisma.page.findUnique.mockResolvedValue(mockPageWithSpace);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPage,
        parentId: null,
      });

      await service.move('page-1', dto);

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { parentId: null },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getVersions
  // ---------------------------------------------------------------------------
  describe('getVersions', () => {
    it('should return paginated versions ordered by createdAt descending', async () => {
      const versions = [
        { ...mockVersion, id: 'v2', createdAt: new Date('2025-02-01') },
        { ...mockVersion, id: 'v1', createdAt: new Date('2025-01-01') },
      ];

      mockPrisma.pageVersion.findMany.mockResolvedValue(versions);
      mockPrisma.pageVersion.count.mockResolvedValue(2);

      const result = await service.getVersions('page-1');

      expect(mockPrisma.pageVersion.findMany).toHaveBeenCalledWith({
        where: { pageId: 'page-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('v2');
      expect(result.total).toBe(2);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('should return an empty paginated result when no versions exist', async () => {
      mockPrisma.pageVersion.findMany.mockResolvedValue([]);
      mockPrisma.pageVersion.count.mockResolvedValue(0);

      const result = await service.getVersions('page-1');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getVersion
  // ---------------------------------------------------------------------------
  describe('getVersion', () => {
    it('should return a specific version when found', async () => {
      mockPrisma.pageVersion.findFirst.mockResolvedValue(mockVersion);

      const result = await service.getVersion('page-1', 'version-1');

      expect(mockPrisma.pageVersion.findFirst).toHaveBeenCalledWith({
        where: { id: 'version-1', pageId: 'page-1' },
      });
      expect(result).toEqual(mockVersion);
    });

    it('should throw NotFoundException when version is not found', async () => {
      mockPrisma.pageVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.getVersion('page-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // restoreVersion
  // ---------------------------------------------------------------------------
  describe('restoreVersion', () => {
    it('should restore page content from a version and create a new version entry', async () => {
      const versionToRestore = {
        ...mockVersion,
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', text: 'old content' }],
        },
      };

      mockPrisma.pageVersion.findFirst.mockResolvedValue(versionToRestore);
      mockPrisma.page.update.mockResolvedValue({
        ...mockPageWithSpace,
        contentJson: versionToRestore.contentJson,
      });
      mockPrisma.pageVersion.create.mockResolvedValue({
        ...mockVersion,
        id: 'version-new',
        contentJson: versionToRestore.contentJson,
        authorId: 'user-2',
      });
      mockSearchService.indexPage.mockResolvedValue(undefined);

      const result = await service.restoreVersion(
        'page-1',
        'version-1',
        'user-2',
      );

      // Verifies the version was looked up
      expect(mockPrisma.pageVersion.findFirst).toHaveBeenCalledWith({
        where: { id: 'version-1', pageId: 'page-1' },
      });

      // Verifies the page was updated with the version content (yjsState cleared)
      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { contentJson: versionToRestore.contentJson, yjsState: null },
        include: { space: true },
      });

      // Verifies a new version entry was created to record the restore
      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          contentJson: versionToRestore.contentJson,
          authorId: 'user-2',
        },
      });

      // Verifies search was re-indexed
      expect(mockSearchService.indexPage).toHaveBeenCalled();

      expect(result.contentJson).toEqual(versionToRestore.contentJson);
    });

    it('should throw NotFoundException if the version to restore does not exist', async () => {
      mockPrisma.pageVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.restoreVersion('page-1', 'nonexistent-version', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.page.update).not.toHaveBeenCalled();
      expect(mockPrisma.pageVersion.create).not.toHaveBeenCalled();
    });

    it('should use empty object when version contentJson is null', async () => {
      const versionWithNullContent = {
        ...mockVersion,
        contentJson: null,
      };

      mockPrisma.pageVersion.findFirst.mockResolvedValue(
        versionWithNullContent,
      );
      mockPrisma.page.update.mockResolvedValue({
        ...mockPageWithSpace,
        contentJson: {},
      });
      mockPrisma.pageVersion.create.mockResolvedValue({
        ...mockVersion,
        contentJson: {},
      });
      mockSearchService.indexPage.mockResolvedValue(undefined);

      await service.restoreVersion('page-1', 'version-1', 'user-1');

      expect(mockPrisma.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { contentJson: {}, yjsState: null },
        include: { space: true },
      });

      expect(mockPrisma.pageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          contentJson: {},
          authorId: 'user-1',
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // notifySpaceMembers (private, tested indirectly through create/update)
  // ---------------------------------------------------------------------------
  describe('notifySpaceMembers (indirect)', () => {
    it('should not crash if notification fails (error is swallowed)', async () => {
      const dto = { title: 'Notify Fail Page' };

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.page.create.mockResolvedValue({
        ...mockPage,
        title: dto.title,
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockRejectedValue(
        new Error('DB error'),
      );
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      // Should not throw even though spacePermission.findMany fails
      const result = await service.create('test-space', dto, 'user-1');

      expect(result).toBeDefined();
      expect(result.title).toBe(dto.title);
    });

    it('should not send notification to the actor themselves', async () => {
      const dto = { title: 'Self Notify Test' };

      // Only member is the author
      const singleMember = [{ userId: 'user-1' }];

      mockPrisma.space.findUnique.mockResolvedValue(mockSpace);
      mockPrisma.page.create.mockResolvedValue({
        ...mockPage,
        title: dto.title,
      });
      mockPrisma.pageVersion.create.mockResolvedValue(mockVersion);
      mockSearchService.indexPage.mockResolvedValue(undefined);
      mockPrisma.spacePermission.findMany.mockResolvedValue(singleMember);
      mockWebhooksService.fireEvent.mockResolvedValue(undefined);

      await service.create('test-space', dto, 'user-1');

      // The author is filtered out, so no notifications should be created
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });
  });
});
