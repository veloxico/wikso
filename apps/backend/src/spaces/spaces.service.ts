import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { SpaceRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class SpacesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notificationsService: NotificationsService,
    private webhooksService: WebhooksService,
  ) {}

  /** Invalidate spaces list cache for a user */
  private async invalidateSpacesCache(userId: string) {
    try {
      await this.redis.del(`cache:spaces:${userId}`);
    } catch {
      // Non-critical
    }
  }

  async create(dto: CreateSpaceDto, userId: string) {
    const exists = await this.prisma.space.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug already taken');

    const space = await this.prisma.space.create({
      data: { ...dto, ownerId: userId },
    });

    await this.prisma.spacePermission.create({
      data: { spaceId: space.id, userId, role: SpaceRole.ADMIN },
    });

    // Invalidate cache
    await this.invalidateSpacesCache(userId);

    // Fire webhook
    await this.webhooksService.fireEvent('space.created', {
      spaceId: space.id,
      name: space.name,
      slug: space.slug,
      ownerId: userId,
    });

    return space;
  }

  async findAll(userId: string) {
    // Try Redis cache first
    const cacheKey = `cache:spaces:${userId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Cache miss or error — proceed to DB
    }

    const spaces = await this.prisma.space.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          { ownerId: userId },
          { permissions: { some: { userId } } },
          { permissions: { some: { group: { members: { some: { userId } } } } } },
        ],
      },
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Cache for 120 seconds
    try {
      await this.redis.set(cacheKey, JSON.stringify(spaces), 120);
    } catch {
      // Non-critical
    }

    return spaces;
  }

  async findBySlug(slug: string) {
    const space = await this.prisma.space.findUnique({
      where: { slug },
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async update(slug: string, dto: UpdateSpaceDto) {
    const existing = await this.prisma.space.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException('Space not found');

    const space = await this.prisma.space.update({ where: { slug }, data: dto });

    await this.webhooksService.fireEvent('space.updated', {
      spaceId: space.id,
      name: space.name,
      slug: space.slug,
    });

    return space;
  }

  async delete(slug: string) {
    const space = await this.prisma.space.findUnique({ where: { slug } });
    if (!space) throw new NotFoundException('Space not found');

    await this.prisma.space.delete({ where: { slug } });

    await this.webhooksService.fireEvent('space.deleted', {
      spaceId: space.id,
      name: space.name,
    });

    return { message: 'Space deleted' };
  }

  async getMembers(slug: string) {
    const space = await this.findBySlug(slug);
    return this.prisma.spacePermission.findMany({
      where: { spaceId: space.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        group: { select: { id: true, name: true, description: true, _count: { select: { members: true } } } },
      },
    });
  }

  async searchMembers(slug: string, query: string) {
    const space = await this.findBySlug(slug);
    const where: any = { spaceId: space.id };

    if (query) {
      where.user = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      };
    }

    const members = await this.prisma.spacePermission.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      take: 10,
    });

    return members
      .filter((m: any) => m.user)
      .map((m: any) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      }));
  }

  async addMember(slug: string, dto: AddMemberDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('Either userId or groupId must be provided');
    }

    const space = await this.findBySlug(slug);
    const permission = await this.prisma.spacePermission.create({
      data: {
        spaceId: space.id,
        userId: dto.userId || null,
        groupId: dto.groupId || null,
        role: dto.role,
      },
    });

    if (dto.userId) {
      await this.invalidateSpacesCache(dto.userId);
      try {
        await this.notificationsService.create(dto.userId, 'space.member_added', {
          spaceId: space.id,
          spaceName: space.name,
          spaceSlug: space.slug,
          role: dto.role,
        });
      } catch {
        // Non-critical
      }
    }

    if (dto.groupId) {
      // Invalidate cache for all group members
      const members = await this.prisma.groupMember.findMany({
        where: { groupId: dto.groupId },
        select: { userId: true },
      });
      for (const m of members) {
        await this.invalidateSpacesCache(m.userId);
      }
    }

    await this.webhooksService.fireEvent('space.member_added', {
      spaceId: space.id,
      userId: dto.userId,
      groupId: dto.groupId,
      role: dto.role,
    });

    return permission;
  }

  async removeMember(slug: string, userId: string) {
    const space = await this.findBySlug(slug);
    await this.prisma.spacePermission.deleteMany({
      where: { spaceId: space.id, userId },
    });

    await this.invalidateSpacesCache(userId);

    try {
      await this.notificationsService.create(userId, 'space.member_removed', {
        spaceId: space.id,
        spaceName: space.name,
        spaceSlug: space.slug,
      });
    } catch {
      // Non-critical
    }

    return { message: 'Member removed' };
  }

  async removeGroupMember(slug: string, groupId: string) {
    const space = await this.findBySlug(slug);

    // Get group members before deleting permission (for cache invalidation)
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    await this.prisma.spacePermission.deleteMany({
      where: { spaceId: space.id, groupId },
    });

    for (const m of members) {
      await this.invalidateSpacesCache(m.userId);
    }

    return { message: 'Group removed from space' };
  }
}
