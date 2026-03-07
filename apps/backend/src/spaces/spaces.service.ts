import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceRole } from '@prisma/client';

@Injectable()
export class SpacesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSpaceDto, userId: string) {
    const exists = await this.prisma.space.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug already taken');

    const space = await this.prisma.space.create({
      data: { ...dto, ownerId: userId },
    });

    await this.prisma.spacePermission.create({
      data: { spaceId: space.id, userId, role: SpaceRole.ADMIN },
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
    return this.prisma.space.update({ where: { slug }, data: dto });
  }

  async delete(slug: string) {
    await this.prisma.space.delete({ where: { slug } });
    return { message: 'Space deleted' };
  }

  async getMembers(slug: string) {
    const space = await this.findBySlug(slug);
    return this.prisma.spacePermission.findMany({
      where: { spaceId: space.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  async addMember(slug: string, userId: string, role: SpaceRole) {
    const space = await this.findBySlug(slug);
    return this.prisma.spacePermission.create({
      data: { spaceId: space.id, userId, role },
    });
  }

  async removeMember(slug: string, userId: string) {
    const space = await this.findBySlug(slug);
    await this.prisma.spacePermission.deleteMany({
      where: { spaceId: space.id, userId },
    });
    return { message: 'Member removed' };
  }
}
