import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';

// Mirror the Prisma enums so the test file does not depend on a generated client
enum SpaceRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  GUEST = 'GUEST',
}

enum SpaceType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  PERSONAL = 'PERSONAL',
}

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = 'user-owner-id';
const MEMBER_ID = 'user-member-id';

const mockSpace = {
  id: 'space-uuid-1',
  slug: 'engineering',
  name: 'Engineering',
  description: 'Engineering team space',
  type: SpaceType.PUBLIC,
  ownerId: OWNER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSpaceWithOwner = {
  ...mockSpace,
  owner: { id: OWNER_ID, name: 'Alice', avatarUrl: null },
};

const mockPermission = {
  id: 'perm-uuid-1',
  spaceId: mockSpace.id,
  userId: OWNER_ID,
  role: SpaceRole.ADMIN,
};

const mockMemberPermissions = [
  {
    id: 'perm-uuid-1',
    spaceId: mockSpace.id,
    userId: OWNER_ID,
    role: SpaceRole.ADMIN,
    user: { id: OWNER_ID, name: 'Alice', email: 'alice@test.com', avatarUrl: null },
  },
  {
    id: 'perm-uuid-2',
    spaceId: mockSpace.id,
    userId: MEMBER_ID,
    role: SpaceRole.EDITOR,
    user: { id: MEMBER_ID, name: 'Bob', email: 'bob@test.com', avatarUrl: null },
  },
];

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  space: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  spacePermission: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
});

const mockNotificationsService = () => ({
  create: jest.fn(),
});

const mockWebhooksService = () => ({
  fireEvent: jest.fn(),
});

const mockRedisService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SpacesService', () => {
  let service: SpacesService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let notifications: ReturnType<typeof mockNotificationsService>;
  let webhooks: ReturnType<typeof mockWebhooksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: RedisService, useFactory: mockRedisService },
        { provide: NotificationsService, useFactory: mockNotificationsService },
        { provide: WebhooksService, useFactory: mockWebhooksService },
      ],
    }).compile();

    service = module.get<SpacesService>(SpacesService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationsService);
    webhooks = module.get(WebhooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  describe('create', () => {
    const dto: CreateSpaceDto = {
      name: 'Engineering',
      slug: 'engineering',
      description: 'Engineering team space',
      type: SpaceType.PUBLIC as any,
    };

    it('should create a space, an ADMIN permission and fire a webhook', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      prisma.space.create.mockResolvedValue(mockSpace);
      prisma.spacePermission.create.mockResolvedValue(mockPermission);
      webhooks.fireEvent.mockResolvedValue(undefined);

      const result = await service.create(dto, OWNER_ID);

      // Space created with correct data
      expect(prisma.space.create).toHaveBeenCalledWith({
        data: { ...dto, ownerId: OWNER_ID },
      });

      // ADMIN permission created for the owner
      expect(prisma.spacePermission.create).toHaveBeenCalledWith({
        data: { spaceId: mockSpace.id, userId: OWNER_ID, role: SpaceRole.ADMIN },
      });

      // Webhook fired with space details
      expect(webhooks.fireEvent).toHaveBeenCalledWith('space.created', {
        spaceId: mockSpace.id,
        name: mockSpace.name,
        slug: mockSpace.slug,
        ownerId: OWNER_ID,
      });

      expect(result).toEqual(mockSpace);
    });

    it('should throw ConflictException when slug already exists', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace);

      await expect(service.create(dto, OWNER_ID)).rejects.toThrow(ConflictException);
      expect(prisma.space.create).not.toHaveBeenCalled();
      expect(prisma.spacePermission.create).not.toHaveBeenCalled();
      expect(webhooks.fireEvent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // findAll
  // -----------------------------------------------------------------------
  describe('findAll', () => {
    it('should return accessible spaces for the user', async () => {
      const spaces = [mockSpaceWithOwner];
      prisma.space.findMany.mockResolvedValue(spaces);

      const result = await service.findAll(OWNER_ID);

      expect(prisma.space.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { type: 'PUBLIC' },
            { ownerId: OWNER_ID },
            { permissions: { some: { userId: OWNER_ID } } },
          ],
        },
        include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
      });

      expect(result).toEqual(spaces);
    });
  });

  // -----------------------------------------------------------------------
  // findBySlug
  // -----------------------------------------------------------------------
  describe('findBySlug', () => {
    it('should return the space when it exists', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);

      const result = await service.findBySlug('engineering');

      expect(prisma.space.findUnique).toHaveBeenCalledWith({
        where: { slug: 'engineering' },
        include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
      });

      expect(result).toEqual(mockSpaceWithOwner);
    });

    it('should throw NotFoundException when space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------
  describe('update', () => {
    const dto: UpdateSpaceDto = { name: 'Engineering v2', description: 'Updated desc' };

    it('should update the space and fire a webhook', async () => {
      const updatedSpace = { ...mockSpace, ...dto };
      prisma.space.findUnique.mockResolvedValue(mockSpace);
      prisma.space.update.mockResolvedValue(updatedSpace);
      webhooks.fireEvent.mockResolvedValue(undefined);

      const result = await service.update('engineering', dto);

      expect(prisma.space.update).toHaveBeenCalledWith({
        where: { slug: 'engineering' },
        data: dto,
      });

      expect(webhooks.fireEvent).toHaveBeenCalledWith('space.updated', {
        spaceId: updatedSpace.id,
        name: updatedSpace.name,
        slug: updatedSpace.slug,
      });

      expect(result).toEqual(updatedSpace);
    });
  });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('should delete the space and fire a webhook', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace);
      prisma.space.delete.mockResolvedValue(mockSpace);
      webhooks.fireEvent.mockResolvedValue(undefined);

      const result = await service.delete('engineering');

      expect(prisma.space.findUnique).toHaveBeenCalledWith({ where: { slug: 'engineering' } });
      expect(prisma.space.delete).toHaveBeenCalledWith({ where: { slug: 'engineering' } });

      expect(webhooks.fireEvent).toHaveBeenCalledWith('space.deleted', {
        spaceId: mockSpace.id,
        name: mockSpace.name,
      });

      expect(result).toEqual({ message: 'Space deleted' });
    });

    it('should throw NotFoundException when the space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);

      expect(prisma.space.delete).not.toHaveBeenCalled();
      expect(webhooks.fireEvent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getMembers
  // -----------------------------------------------------------------------
  describe('getMembers', () => {
    it('should return the members list for a space', async () => {
      // findBySlug is called internally
      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);
      prisma.spacePermission.findMany.mockResolvedValue(mockMemberPermissions);

      const result = await service.getMembers('engineering');

      expect(prisma.spacePermission.findMany).toHaveBeenCalledWith({
        where: { spaceId: mockSpaceWithOwner.id },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      expect(result).toEqual(mockMemberPermissions);
    });

    it('should throw NotFoundException when the space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.getMembers('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.spacePermission.findMany).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // addMember
  // -----------------------------------------------------------------------
  describe('addMember', () => {
    it('should create a permission, send a notification and fire a webhook', async () => {
      const newPermission = {
        id: 'perm-uuid-new',
        spaceId: mockSpace.id,
        userId: MEMBER_ID,
        role: SpaceRole.EDITOR,
      };

      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);
      prisma.spacePermission.create.mockResolvedValue(newPermission);
      notifications.create.mockResolvedValue(undefined);
      webhooks.fireEvent.mockResolvedValue(undefined);

      const result = await service.addMember('engineering', { userId: MEMBER_ID, role: SpaceRole.EDITOR });

      // Permission created
      expect(prisma.spacePermission.create).toHaveBeenCalledWith({
        data: { spaceId: mockSpaceWithOwner.id, userId: MEMBER_ID, role: SpaceRole.EDITOR },
      });

      // Notification sent to the new member
      expect(notifications.create).toHaveBeenCalledWith(MEMBER_ID, 'space.member_added', {
        spaceId: mockSpaceWithOwner.id,
        spaceName: mockSpaceWithOwner.name,
        spaceSlug: mockSpaceWithOwner.slug,
        role: SpaceRole.EDITOR,
      });

      // Webhook fired
      expect(webhooks.fireEvent).toHaveBeenCalledWith('space.member_added', {
        spaceId: mockSpaceWithOwner.id,
        userId: MEMBER_ID,
        role: SpaceRole.EDITOR,
      });

      expect(result).toEqual(newPermission);
    });

    it('should still succeed when notification creation fails', async () => {
      const newPermission = {
        id: 'perm-uuid-new',
        spaceId: mockSpace.id,
        userId: MEMBER_ID,
        role: SpaceRole.VIEWER,
      };

      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);
      prisma.spacePermission.create.mockResolvedValue(newPermission);
      notifications.create.mockRejectedValue(new Error('Notification service down'));
      webhooks.fireEvent.mockResolvedValue(undefined);

      const result = await service.addMember('engineering', { userId: MEMBER_ID, role: SpaceRole.VIEWER });

      // Should not throw despite notification failure
      expect(result).toEqual(newPermission);
      // Webhook should still fire
      expect(webhooks.fireEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('nonexistent', { userId: MEMBER_ID, role: SpaceRole.EDITOR }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.spacePermission.create).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(webhooks.fireEvent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // removeMember
  // -----------------------------------------------------------------------
  describe('removeMember', () => {
    it('should remove the permission and send a notification', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);
      prisma.spacePermission.deleteMany.mockResolvedValue({ count: 1 });
      notifications.create.mockResolvedValue(undefined);

      const result = await service.removeMember('engineering', MEMBER_ID);

      expect(prisma.spacePermission.deleteMany).toHaveBeenCalledWith({
        where: { spaceId: mockSpaceWithOwner.id, userId: MEMBER_ID },
      });

      expect(notifications.create).toHaveBeenCalledWith(MEMBER_ID, 'space.member_removed', {
        spaceId: mockSpaceWithOwner.id,
        spaceName: mockSpaceWithOwner.name,
        spaceSlug: mockSpaceWithOwner.slug,
      });

      expect(result).toEqual({ message: 'Member removed' });
    });

    it('should still succeed when notification creation fails', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpaceWithOwner);
      prisma.spacePermission.deleteMany.mockResolvedValue({ count: 1 });
      notifications.create.mockRejectedValue(new Error('Notification service down'));

      const result = await service.removeMember('engineering', MEMBER_ID);

      expect(result).toEqual({ message: 'Member removed' });
    });

    it('should throw NotFoundException when the space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('nonexistent', MEMBER_ID)).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.spacePermission.deleteMany).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
