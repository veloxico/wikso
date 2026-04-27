'use client';

import { useState } from 'react';
import { MessageSquare, Send, Trash2, Reply, CornerDownRight, Pencil, Check, X } from 'lucide-react';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '@/hooks/useComments';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/features/MentionInput';
import { CommentReactions } from '@/components/features/CommentReactions';
import { avatarStyle, initialsFor } from '@/lib/avatarColor';
import type { Comment } from '@/types';
import { toast } from 'sonner';

/** Render mention markup @[Name](id) as styled text */
function renderContent(content: string) {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <span key={i} className="mention">
          @{match[1]}
        </span>
      );
    }
    return part;
  });
}

/** Format a comment timestamp: full datetime under 1h, then relative. */
function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
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
      {/* New comment composer */}
      <form onSubmit={handleSubmit} className="wp-comment-composer">
        <div className="wp-comment-avatar" style={avatarStyle(user?.name)}>
          {initialsFor(user?.name)}
        </div>
        <div className="grow">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            placeholder={t('comments.addComment')}
          />
        </div>
        <button
          type="submit"
          className="send"
          disabled={createComment.isPending || !newComment.trim()}
          aria-label={t('comments.send') || 'Send'}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Empty state */}
      {rootComments.length === 0 && (
        <div
          className="py-10 text-center"
          style={{
            border: '1px dashed var(--rule)',
            borderRadius: '10px',
            background: 'var(--bg-sunken)',
          }}
        >
          <MessageSquare
            className="mx-auto mb-2 h-8 w-8"
            style={{ color: 'var(--ink-4)', opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {t('comments.noComments')}
          </p>
        </div>
      )}

      {/* Comment list */}
      {rootComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          pageId={pageId}
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
  pageId: string;
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
  pageId,
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
  const authorInitial = initialsFor(authorName);
  const isOwner = comment.authorId === userId;
  const isReplyOpen = replyingTo === comment.id;
  const isEditingThis = editingId === comment.id;

  return (
    <div className="wp-comment">
      <div className="wp-comment-avatar" style={avatarStyle(authorName)}>
        {authorInitial}
      </div>

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="wp-comment-meta">
          <span className="name">
            {isOwner ? t('common.you') : authorName}
          </span>
          <span className="time" title={new Date(comment.createdAt).toLocaleString(locale)}>
            {formatTime(comment.createdAt, locale)}
          </span>
          {isOwner && <span className="badge">{t('common.you')}</span>}
        </div>

        {/* Content or Edit form */}
        {isEditingThis ? (
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
                  onSaveEdit(comment.id);
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              style={{ color: 'var(--accent)' }}
              onClick={() => onSaveEdit(comment.id)}
              disabled={isEditing || !editContent.trim()}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onCancelEdit}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="wp-comment-body">{renderContent(comment.content)}</div>
        )}

        {/* Reactions row */}
        {!isEditingThis && (
          <div className="mt-2">
            <CommentReactions
              reactions={comment.reactions || []}
              commentId={comment.id}
              pageId={pageId}
              currentUserId={userId}
            />
          </div>
        )}

        {/* Actions */}
        {!isEditingThis && (
          <div className="wp-comment-actions">
            <button type="button" onClick={() => onStartReply(comment.id)}>
              <Reply className="h-3 w-3" />
              {t('comments.reply')}
            </button>
            {isOwner && (
              <>
                <span className="sep" />
                <button type="button" onClick={() => onStartEdit(comment.id, comment.content)}>
                  <Pencil className="h-3 w-3" />
                  {t('comments.edit')}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(comment.id)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3 w-3" />
                  {t('comments.delete')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply form */}
        {isReplyOpen && (
          <div className="mt-3 flex gap-2 items-start">
            <CornerDownRight
              className="mt-2 h-4 w-4 shrink-0"
              style={{ color: 'var(--ink-4)' }}
            />
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
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
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
          <div className="wp-thread">
            {comment.children.map((reply) => {
              const replyAuthorName =
                (reply as any).author?.name ||
                (reply.authorId === userId ? t('common.you') : t('common.user'));
              const replyIsOwner = reply.authorId === userId;
              const isEditingReply = editingId === reply.id;
              return (
                <div key={reply.id} className="wp-comment">
                  <div className="wp-comment-avatar" style={avatarStyle(replyAuthorName)}>
                    {initialsFor(replyAuthorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="wp-comment-meta">
                      <span className="name">
                        {replyIsOwner ? t('common.you') : replyAuthorName}
                      </span>
                      <span className="time" title={new Date(reply.createdAt).toLocaleString(locale)}>
                        {formatTime(reply.createdAt, locale)}
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
                          className="h-6 w-6"
                          style={{ color: 'var(--accent)' }}
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
                      <div className="wp-comment-body" style={{ fontSize: '13px' }}>
                        {renderContent(reply.content)}
                      </div>
                    )}
                    {!isEditingReply && (
                      <div className="mt-1.5">
                        <CommentReactions
                          reactions={reply.reactions || []}
                          commentId={reply.id}
                          pageId={pageId}
                          currentUserId={userId}
                        />
                      </div>
                    )}
                    {!isEditingReply && replyIsOwner && (
                      <div className="wp-comment-actions">
                        <button type="button" onClick={() => onStartEdit(reply.id, reply.content)}>
                          <Pencil className="h-3 w-3" />
                          {t('comments.edit')}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onDelete(reply.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('comments.delete')}
                        </button>
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
  );
}
