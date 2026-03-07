import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private webhooksService: WebhooksService,
  ) {}

  async create(pageId: string, dto: CreateCommentDto, authorId: string) {
    const comment = await this.prisma.comment.create({
      data: { ...dto, pageId, authorId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Get the page to find its author and space info
    try {
      const page = await this.prisma.page.findUnique({
        where: { id: pageId },
        include: { space: true },
      });

      if (page) {
        // Notify the page author if they're not the commenter
        if (page.authorId !== authorId) {
          await this.notificationsService.create(page.authorId, 'comment.created', {
            commentId: comment.id,
            pageId,
            pageTitle: page.title,
            authorName: comment.author?.name || 'Someone',
            content: dto.content.substring(0, 100),
            spaceSlug: page.space?.slug,
          });
        }

        // If replying to a comment, also notify the parent comment author
        if (dto.parentId) {
          const parentComment = await this.prisma.comment.findUnique({
            where: { id: dto.parentId },
          });
          if (parentComment && parentComment.authorId !== authorId && parentComment.authorId !== page.authorId) {
            await this.notificationsService.create(parentComment.authorId, 'comment.reply', {
              commentId: comment.id,
              pageId,
              pageTitle: page.title,
              authorName: comment.author?.name || 'Someone',
              content: dto.content.substring(0, 100),
              spaceSlug: page.space?.slug,
            });
          }
        }
      }

      // Fire webhook
      await this.webhooksService.fireEvent('comment.created', {
        commentId: comment.id,
        pageId,
        authorId,
        content: dto.content.substring(0, 200),
      });
    } catch {
      // Non-critical — don't break the main flow
    }

    return comment;
  }

  async findByPage(pageId: string) {
    return this.prisma.comment.findMany({
      where: { pageId, parentId: null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        children: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
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

    // Fire webhook
    try {
      await this.webhooksService.fireEvent('comment.deleted', {
        commentId: id,
        pageId: comment.pageId,
      });
    } catch {
      // Non-critical
    }

    return { message: 'Comment deleted' };
  }
}
