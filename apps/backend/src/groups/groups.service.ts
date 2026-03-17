import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 20, search?: string) {
    const where: Prisma.GroupWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { members: true } } },
      }),
      this.prisma.group.count({ where }),
    ]);
    return { groups, total };
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async create(name: string, description?: string) {
    const existing = await this.prisma.group.findUnique({ where: { name } });
    if (existing) throw new ConflictException('Group with this name already exists');

    return this.prisma.group.create({
      data: { name, description },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');

    if (data.name && data.name !== group.name) {
      const existing = await this.prisma.group.findUnique({ where: { name: data.name } });
      if (existing) throw new ConflictException('Group with this name already exists');
    }

    return this.prisma.group.update({
      where: { id },
      data,
      include: { _count: { select: { members: true } } },
    });
  }

  async delete(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');

    await this.prisma.group.delete({ where: { id } });
    return { message: 'Group deleted' };
  }

  async getMembers(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) throw new ConflictException('User is already a member of this group');

    return this.prisma.groupMember.create({
      data: { groupId, userId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  async removeMember(groupId: string, userId: string) {
    await this.prisma.groupMember.deleteMany({ where: { groupId, userId } });
    return { message: 'Member removed from group' };
  }

  async findByUser(userId: string) {
    return this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async search(query: string, limit = 10) {
    if (!query || query.trim().length === 0) return [];
    return this.prisma.group.findMany({
      where: { name: { contains: query.trim(), mode: 'insensitive' } },
      select: { id: true, name: true, description: true, _count: { select: { members: true } } },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }
}
