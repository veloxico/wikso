'use client';

import { useState } from 'react';
import { MessageSquare, Send, Trash2, Reply, CornerDownRight, Pencil, Check, X } from 'lucide-react';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '@/hooks/useComments';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MentionInput } from '@/components/features/MentionInput';
import type { Comment } from '@/types';
import { toast } from 'sonner';

/** Render mention markup @[Name](id) as styled text */
function renderContent(content: string) {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
          @{match[1]}
        </span>
      );
    }
    return part;
  });
}

interface CommentsProps {
  pageId: string;
}

export function Comments({ pageId }: CommentsProps) {
  const { data: comments, isLoading } = useComments(pageId);
  const createComment = useCreateComment(pageId);
  const deleteComment = useDeleteComment(pageId);
  const updateComment = useUpdateComment(pageId);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
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
          toast.success(t('comments.commentAdded'));
        },
        onError: () => toast.error(t('comments.failedToAdd')),
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
          toast.success(t('comments.replyAdded'));
        },
        onError: () => toast.error(t('comments.failedToReply')),
      },
    );
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId, {
      onSuccess: () => toast.success(t('comments.commentDeleted')),
      onError: () => toast.error(t('comments.failedToDelete')),
    });
  };

  const handleStartEdit = (commentId: string, content: string) => {
    setEditingId(commentId);
    setEditContent(content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    updateComment.mutate(
      { commentId, content: editContent },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditContent('');
          toast.success(t('comments.commentUpdated'));
        },
        onError: () => toast.error(t('comments.failedToUpdate')),
      },
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
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
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          placeholder={t('comments.addComment')}
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
          editingId={editingId}
          editContent={editContent}
          onEditContentChange={setEditContent}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          isDeleting={deleteComment.isPending}
          isReplying={createComment.isPending}
          isEditing={updateComment.isPending}
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
  editingId: string | null;
  editContent: string;
  onEditContentChange: (val: string) => void;
  onStartEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  isDeleting: boolean;
  isReplying: boolean;
  isEditing: boolean;
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
  editingId,
  editContent,
  onEditContentChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isDeleting,
  isReplying,
  isEditing,
  t,
  locale,
}: CommentItemProps) {
  const authorName =
    (comment as any).author?.name ||
    (comment.authorId === userId ? t('common.you') : t('common.user'));
  const authorInitial = authorName.charAt(0).toUpperCase();
  const isOwner = comment.authorId === userId;
  const isReplyOpen = replyingTo === comment.id;
  const isEditingThis = editingId === comment.id;

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
              {isOwner ? t('common.you') : authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString(locale)}
            </span>
          </div>

          {/* Content or Edit form */}
          {isEditingThis ? (
            <div className="mt-2 flex gap-2">
              <MentionInput
                value={editContent}
                onChange={onEditContentChange}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCancelEdit();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSaveEdit(comment.id);
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-green-600"
                onClick={() => onSaveEdit(comment.id)}
                disabled={isEditing || !editContent.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
              {renderContent(comment.content)}
            </p>
          )}

          {/* Actions */}
          {!isEditingThis && (
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
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={() => onStartEdit(comment.id, comment.content)}
                  >
                    <Pencil className="h-3 w-3" />
                    {t('comments.edit')}
                  </Button>
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
                </>
              )}
            </div>
          )}

          {/* Reply form */}
          {isReplyOpen && (
            <div className="mt-3 flex gap-2">
              <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <MentionInput
                value={replyContent}
                onChange={onReplyContentChange}
                placeholder={t('comments.writeReply')}
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
                  (reply.authorId === userId ? t('common.you') : t('common.user'));
                const replyIsOwner = reply.authorId === userId;
                const isEditingReply = editingId === reply.id;
                return (
                  <div key={reply.id} className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {replyAuthorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {replyIsOwner ? t('common.you') : replyAuthorName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleString(locale)}
                        </span>
                      </div>
                      {isEditingReply ? (
                        <div className="mt-1 flex gap-2">
                          <MentionInput
                            value={editContent}
                            onChange={onEditContentChange}
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') onCancelEdit();
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSaveEdit(reply.id);
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-green-600"
                            onClick={() => onSaveEdit(reply.id)}
                            disabled={isEditing || !editContent.trim()}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={onCancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                          {renderContent(reply.content)}
                        </p>
                      )}
                      {!isEditingReply && replyIsOwner && (
                        <div className="mt-1 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs text-muted-foreground"
                            onClick={() => onStartEdit(reply.id, reply.content)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => onDelete(reply.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
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
