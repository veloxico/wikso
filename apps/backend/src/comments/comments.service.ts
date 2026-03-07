import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(pageId: string, dto: CreateCommentDto, authorId: string) {
    return this.prisma.comment.create({
      data: { ...dto, pageId, authorId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async findByPage(pageId: string) {
    return this.prisma.comment.findMany({
      where: { pageId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        children: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException();

    return this.prisma.comment.update({
      where: { id },
      data: { content: dto.content },
    });
  }

  async delete(id: string, userId: string, isAdmin: boolean) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && !isAdmin) throw new ForbiddenException();

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Comment deleted' };
  }
}
