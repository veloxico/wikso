import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { MailService } from '../mail/mail.service';
import { PageWatchService } from '../page-watch/page-watch.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    comment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    page: {
      findUnique: jest.Mock;
    };
  };
  let notificationsService: { create: jest.Mock };
  let webhooksService: { fireEvent: jest.Mock };

  beforeEach(async () => {
    prisma = {
      comment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      page: {
        findUnique: jest.fn(),
      },
    };

    notificationsService = {
      create: jest.fn(),
    };

    webhooksService = {
      fireEvent: jest.fn(),
    };

    const mailService = {
      isConfigured: jest.fn(() => false),
      sendCommentNotification: jest.fn(),
      sendMentionNotification: jest.fn(),
    };

    const pageWatch = {
      ensureWatching: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: MailService, useValue: mailService },
        { provide: PageWatchService, useValue: pageWatch },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const pageId = 'page-1';
    const authorId = 'user-1';
    const dto: CreateCommentDto = { content: 'Nice article!' };

    const createdComment = {
      id: 'comment-1',
      content: dto.content,
      pageId,
      authorId,
      parentId: null,
      author: { id: authorId, name: 'Alice', avatarUrl: null },
      createdAt: new Date(),
    };

    const page = {
      id: pageId,
      title: 'Test Page',
      authorId: 'user-2',
      space: { slug: 'engineering' },
    };

    it('should create a comment and notify the page author', async () => {
      prisma.comment.create.mockResolvedValue(createdComment);
      // First call: soft-delete check, second call: notification lookup
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockResolvedValueOnce(page);
      notificationsService.create.mockResolvedValue(undefined);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.create(pageId, dto, authorId);

      expect(result).toEqual(createdComment);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: { ...dto, pageId, authorId },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });

      // Notify page author (user-2)
      expect(notificationsService.create).toHaveBeenCalledWith(
        page.authorId,
        'comment.created',
        expect.objectContaining({
          commentId: createdComment.id,
          pageId,
          pageTitle: page.title,
          authorName: 'Alice',
          content: dto.content.substring(0, 100),
          spaceSlug: 'engineering',
        }),
      );

      // Fire webhook
      expect(webhooksService.fireEvent).toHaveBeenCalledWith('comment.created', {
        commentId: createdComment.id,
        pageId,
        authorId,
        content: dto.content.substring(0, 200),
      });
    });

    it('should create a reply and also notify the parent comment author', async () => {
      const parentCommentAuthorId = 'user-3';
      const replyDto: CreateCommentDto = {
        content: 'I agree!',
        parentId: 'parent-comment-1',
      };

      const replyComment = {
        ...createdComment,
        id: 'comment-2',
        content: replyDto.content,
        parentId: replyDto.parentId,
      };

      const parentComment = {
        id: 'parent-comment-1',
        authorId: parentCommentAuthorId,
        pageId,
      };

      prisma.comment.create.mockResolvedValue(replyComment);
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockResolvedValueOnce(page);
      prisma.comment.findUnique.mockResolvedValue(parentComment);
      notificationsService.create.mockResolvedValue(undefined);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.create(pageId, replyDto, authorId);

      expect(result).toEqual(replyComment);

      // Should notify the page author
      expect(notificationsService.create).toHaveBeenCalledWith(
        page.authorId,
        'comment.created',
        expect.objectContaining({ commentId: replyComment.id }),
      );

      // Should also notify the parent comment author
      expect(notificationsService.create).toHaveBeenCalledWith(
        parentCommentAuthorId,
        'comment.reply',
        expect.objectContaining({
          commentId: replyComment.id,
          pageId,
          pageTitle: page.title,
          authorName: 'Alice',
          content: replyDto.content.substring(0, 100),
          spaceSlug: 'engineering',
        }),
      );

      expect(notificationsService.create).toHaveBeenCalledTimes(2);
    });

    it('should NOT notify the page author when the commenter is the page author', async () => {
      const selfAuthoredPage = { ...page, authorId };

      prisma.comment.create.mockResolvedValue(createdComment);
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockResolvedValueOnce(selfAuthoredPage);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      await service.create(pageId, dto, authorId);

      // No notification should be sent to self
      expect(notificationsService.create).not.toHaveBeenCalled();

      // Webhook should still fire
      expect(webhooksService.fireEvent).toHaveBeenCalledTimes(1);
    });

    it('should NOT notify the parent comment author when they are the same as the commenter', async () => {
      const replyDto: CreateCommentDto = {
        content: 'Replying to myself',
        parentId: 'parent-comment-1',
      };

      const replyComment = {
        ...createdComment,
        id: 'comment-3',
        content: replyDto.content,
        parentId: replyDto.parentId,
      };

      // Parent comment is authored by the same person replying
      const parentComment = {
        id: 'parent-comment-1',
        authorId,
        pageId,
      };

      prisma.comment.create.mockResolvedValue(replyComment);
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockResolvedValueOnce(page);
      prisma.comment.findUnique.mockResolvedValue(parentComment);
      notificationsService.create.mockResolvedValue(undefined);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      await service.create(pageId, replyDto, authorId);

      // Should notify the page author only (not the parent comment author since it is the commenter)
      expect(notificationsService.create).toHaveBeenCalledTimes(1);
      expect(notificationsService.create).toHaveBeenCalledWith(
        page.authorId,
        'comment.created',
        expect.anything(),
      );
    });

    it('should NOT notify the parent comment author when they are the page author (already notified)', async () => {
      const replyDto: CreateCommentDto = {
        content: 'Nice reply',
        parentId: 'parent-comment-1',
      };

      const replyComment = {
        ...createdComment,
        id: 'comment-4',
        content: replyDto.content,
        parentId: replyDto.parentId,
      };

      // Parent comment authored by the page author
      const parentComment = {
        id: 'parent-comment-1',
        authorId: page.authorId,
        pageId,
      };

      prisma.comment.create.mockResolvedValue(replyComment);
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockResolvedValueOnce(page);
      prisma.comment.findUnique.mockResolvedValue(parentComment);
      notificationsService.create.mockResolvedValue(undefined);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      await service.create(pageId, replyDto, authorId);

      // Should notify page author via 'comment.created' only; no duplicate 'comment.reply'
      expect(notificationsService.create).toHaveBeenCalledTimes(1);
      expect(notificationsService.create).toHaveBeenCalledWith(
        page.authorId,
        'comment.created',
        expect.anything(),
      );
    });

    it('should still return the comment even if notifications/webhooks throw', async () => {
      prisma.comment.create.mockResolvedValue(createdComment);
      // First call: soft-delete check (must succeed), second call: notification lookup (can fail)
      prisma.page.findUnique
        .mockResolvedValueOnce({ deletedAt: null })
        .mockRejectedValueOnce(new Error('DB down'));

      const result = await service.create(pageId, dto, authorId);

      expect(result).toEqual(createdComment);
    });

    it('should throw NotFoundException when the page is soft-deleted', async () => {
      prisma.page.findUnique.mockResolvedValue({ deletedAt: new Date() });

      await expect(service.create(pageId, dto, authorId)).rejects.toThrow(NotFoundException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the page does not exist', async () => {
      prisma.page.findUnique.mockResolvedValue(null);

      await expect(service.create(pageId, dto, authorId)).rejects.toThrow(NotFoundException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findByPage
  // ---------------------------------------------------------------------------
  describe('findByPage', () => {
    it('should return paginated root comments with nested children', async () => {
      const pageId = 'page-1';
      const commentsTree = [
        {
          id: 'c1',
          content: 'First',
          parentId: null,
          author: { id: 'u1', name: 'Alice', avatarUrl: null },
          children: [
            {
              id: 'c3',
              content: 'Reply to first',
              parentId: 'c1',
              author: { id: 'u2', name: 'Bob', avatarUrl: null },
            },
          ],
        },
        {
          id: 'c2',
          content: 'Second',
          parentId: null,
          author: { id: 'u2', name: 'Bob', avatarUrl: null },
          children: [],
        },
      ];

      prisma.comment.findMany.mockResolvedValue(commentsTree);
      prisma.comment.count.mockResolvedValue(2);

      const result = await service.findByPage(pageId);

      expect(result.data).toEqual(commentsTree);
      expect(result.total).toBe(2);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(50);
      // Reactions are included so clients can render emoji reactions without
      // a second round-trip. The shape matches the reactionInclude constant
      // defined inside findByPage — keep them in sync when the shape changes.
      const reactionInclude = {
        select: {
          id: true,
          emoji: true,
          userId: true,
          user: { select: { id: true, name: true } },
        },
      };
      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { pageId, parentId: null },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reactions: reactionInclude,
          children: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              reactions: reactionInclude,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 50,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const commentId = 'comment-1';
    const ownerId = 'user-1';
    const existingComment = {
      id: commentId,
      content: 'Original content',
      authorId: ownerId,
      pageId: 'page-1',
    };

    const updateDto: UpdateCommentDto = { content: 'Updated content' };

    it('should update the comment when the user is the owner', async () => {
      const updatedComment = { ...existingComment, content: updateDto.content };

      prisma.comment.findUnique.mockResolvedValue(existingComment);
      prisma.comment.update.mockResolvedValue(updatedComment);

      const result = await service.update(commentId, updateDto, ownerId);

      expect(result).toEqual(updatedComment);
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({ where: { id: commentId } });
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: { content: updateDto.content },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });
    });

    it('should throw ForbiddenException when the user is not the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue(existingComment);

      await expect(service.update(commentId, updateDto, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto, ownerId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.comment.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------
  describe('delete', () => {
    const commentId = 'comment-1';
    const ownerId = 'user-1';
    const existingComment = {
      id: commentId,
      content: 'To be deleted',
      authorId: ownerId,
      pageId: 'page-1',
    };

    it('should delete the comment when the user is the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue(existingComment);
      prisma.comment.delete.mockResolvedValue(existingComment);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.delete(commentId, ownerId, false);

      expect(result).toEqual({ message: 'Comment deleted' });
      expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: commentId } });
      expect(webhooksService.fireEvent).toHaveBeenCalledWith('comment.deleted', {
        commentId,
        pageId: existingComment.pageId,
      });
    });

    it('should delete the comment when the user is an admin but not the owner', async () => {
      prisma.comment.findUnique.mockResolvedValue(existingComment);
      prisma.comment.delete.mockResolvedValue(existingComment);
      webhooksService.fireEvent.mockResolvedValue(undefined);

      const result = await service.delete(commentId, 'admin-user', true);

      expect(result).toEqual({ message: 'Comment deleted' });
      expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: commentId } });
      expect(webhooksService.fireEvent).toHaveBeenCalledWith('comment.deleted', {
        commentId,
        pageId: existingComment.pageId,
      });
    });

    it('should throw ForbiddenException when the user is not the owner and not admin', async () => {
      prisma.comment.findUnique.mockResolvedValue(existingComment);

      await expect(service.delete(commentId, 'other-user', false)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.comment.delete).not.toHaveBeenCalled();
      expect(webhooksService.fireEvent).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', ownerId, false)).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.comment.delete).not.toHaveBeenCalled();
      expect(webhooksService.fireEvent).not.toHaveBeenCalled();
    });

    it('should still return success even if the webhook throws', async () => {
      prisma.comment.findUnique.mockResolvedValue(existingComment);
      prisma.comment.delete.mockResolvedValue(existingComment);
      webhooksService.fireEvent.mockRejectedValue(new Error('Webhook failed'));

      const result = await service.delete(commentId, ownerId, false);

      expect(result).toEqual({ message: 'Comment deleted' });
    });
  });
});
