import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceRole } from '@prisma/client';

@Injectable()
export class SpacesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private webhooksService: WebhooksService,
  ) {}

  async create(dto: CreateSpaceDto, userId: string) {
    const exists = await this.prisma.space.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug already taken');

    const space = await this.prisma.space.create({
      data: { ...dto, ownerId: userId },
    });

    await this.prisma.spacePermission.create({
      data: { spaceId: space.id, userId, role: SpaceRole.ADMIN },
    });

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
    return this.prisma.space.findMany({
      where: {
        OR: [
          { type: 'PUBLIC' },
          { ownerId: userId },
          { permissions: { some: { userId } } },
        ],
      },
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });
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
    await this.prisma.space.delete({ where: { slug } });

    if (space) {
      await this.webhooksService.fireEvent('space.deleted', {
        spaceId: space.id,
        name: space.name,
      });
    }

    return { message: 'Space deleted' };
  }

  async getMembers(slug: string) {
    const space = await this.findBySlug(slug);
    return this.prisma.spacePermission.findMany({
      where: { spaceId: space.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
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

  async addMember(slug: string, userId: string, role: SpaceRole) {
    const space = await this.findBySlug(slug);
    const permission = await this.prisma.spacePermission.create({
      data: { spaceId: space.id, userId, role },
    });

    // Notify the new member
    try {
      await this.notificationsService.create(userId, 'space.member_added', {
        spaceId: space.id,
        spaceName: space.name,
        spaceSlug: space.slug,
        role,
      });
    } catch {
      // Non-critical
    }

    await this.webhooksService.fireEvent('space.member_added', {
      spaceId: space.id,
      userId,
      role,
    });

    return permission;
  }

  async removeMember(slug: string, userId: string) {
    const space = await this.findBySlug(slug);
    await this.prisma.spacePermission.deleteMany({
      where: { spaceId: space.id, userId },
    });

    // Notify the removed member
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
}
