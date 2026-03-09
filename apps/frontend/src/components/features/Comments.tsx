'use client';

import { useState } from 'react';
import { MessageSquare, Send, Trash2, Reply, CornerDownRight } from 'lucide-react';
import { useComments, useCreateComment, useDeleteComment } from '@/hooks/useComments';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Comment } from '@/types';
import { toast } from 'sonner';

interface CommentsProps {
  pageId: string;
}

export function Comments({ pageId }: CommentsProps) {
  const { data: comments, isLoading } = useComments(pageId);
  const createComment = useCreateComment(pageId);
  const deleteComment = useDeleteComment(pageId);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const user = useAuthStore((s) => s.user);
  const { t, locale } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createComment.mutate(
      { content: newComment },
      {
        onSuccess: () => {
          setNewComment('');
          toast.success('Comment added');
        },
        onError: () => toast.error('Failed to add comment'),
      },
    );
  };

  const handleReply = (parentId: string) => {
    if (!replyContent.trim()) return;
    createComment.mutate(
      { content: replyContent, parentId },
      {
        onSuccess: () => {
          setReplyContent('');
          setReplyingTo(null);
          toast.success('Reply added');
        },
        onError: () => toast.error('Failed to add reply'),
      },
    );
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId, {
      onSuccess: () => toast.success('Comment deleted'),
      onError: () => toast.error('Failed to delete comment'),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  // Filter to only root-level comments (no parentId)
  const rootComments = comments?.filter((c) => !c.parentId) || [];

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {user?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('comments.addComment')}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={createComment.isPending || !newComment.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Empty state */}
      {rootComments.length === 0 && (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {t('comments.noComments')}
          </p>
        </div>
      )}

      {/* Comment list */}
      {rootComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          userId={user?.id}
          replyingTo={replyingTo}
          replyContent={replyContent}
          onReplyContentChange={setReplyContent}
          onStartReply={(id) => {
            setReplyingTo(id);
            setReplyContent('');
          }}
          onCancelReply={() => setReplyingTo(null)}
          onSubmitReply={handleReply}
          onDelete={handleDelete}
          isDeleting={deleteComment.isPending}
          isReplying={createComment.isPending}
          t={t}
          locale={locale}
        />
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment & { author?: { id: string; name: string; avatarUrl?: string } };
  userId?: string;
  replyingTo: string | null;
  replyContent: string;
  onReplyContentChange: (val: string) => void;
  onStartReply: (id: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isReplying: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

function CommentItem({
  comment,
  userId,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onDelete,
  isDeleting,
  isReplying,
  t,
  locale,
}: CommentItemProps) {
  const authorName =
    (comment as any).author?.name ||
    (comment.authorId === userId ? 'You' : 'User');
  const authorInitial = authorName.charAt(0).toUpperCase();
  const isOwner = comment.authorId === userId;
  const isReplyOpen = replyingTo === comment.id;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {authorInitial}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isOwner ? 'You' : authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString(locale)}
            </span>
          </div>

          {/* Content */}
          <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => onStartReply(comment.id)}
            >
              <Reply className="h-3 w-3" />
              {t('comments.reply')}
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(comment.id)}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3" />
                {t('comments.delete')}
              </Button>
            )}
          </div>

          {/* Reply form */}
          {isReplyOpen && (
            <div className="mt-3 flex gap-2">
              <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder={t('comments.writeReply')}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancelReply();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmitReply(comment.id);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => onSubmitReply(comment.id)}
                disabled={isReplying || !replyContent.trim()}
              >
                {t('comments.reply')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelReply}>
                {t('common.cancel')}
              </Button>
            </div>
          )}

          {/* Threaded replies */}
          {comment.children && comment.children.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
              {comment.children.map((reply) => {
                const replyAuthorName =
                  (reply as any).author?.name ||
                  (reply.authorId === userId ? 'You' : 'User');
                const replyIsOwner = reply.authorId === userId;
                return (
                  <div key={reply.id} className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {replyAuthorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {replyIsOwner ? 'You' : replyAuthorName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleString(locale)}
                        </span>
                        {replyIsOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                            onClick={() => onDelete(reply.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
