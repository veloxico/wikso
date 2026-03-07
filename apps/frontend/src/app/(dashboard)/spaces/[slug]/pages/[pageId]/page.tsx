'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, Clock, Users, Paperclip, History } from 'lucide-react';
import { usePage, useUpdatePage } from '@/hooks/usePages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Attachments } from '@/components/features/Attachments';
import { PageVersions } from '@/components/features/PageVersions';

// Динамический импорт — Yjs / Hocuspocus не работают на сервере
const CollaborativeEditor = dynamic(
  () => import('@/components/features/CollaborativeEditor').then((m) => m.CollaborativeEditor),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" /> }
);

export default function PageEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const pageId = params.pageId as string;

  const { data: page, isLoading } = usePage(slug, pageId);
  const updatePage = useUpdatePage(slug, pageId);
  const [title, setTitle] = useState('');
  const [titleInitialized, setTitleInitialized] = useState(false);

  if (page && !titleInitialized) {
    setTitle(page.title);
    setTitleInitialized(true);
  }

  const handleSaveTitle = useCallback(() => {
    if (title && title !== page?.title) {
      updatePage.mutate({ title });
    }
  }, [title, page, updatePage]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-4 h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveTitle}
          className="border-none bg-transparent text-3xl font-bold shadow-none focus-visible:ring-0 px-0"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-2">
          {page?.updatedAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          )}
          <Button onClick={handleSaveTitle} disabled={updatePage.isPending} size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            {updatePage.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Collaborative Editor (Yjs + Hocuspocus) */}
      <CollaborativeEditor pageId={pageId} />

      {/* Attachments */}
      <div className="mt-8 border-t border-border pt-6">
        <Attachments pageId={pageId} />
      </div>

      {/* Version History */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" />
          Version History
        </h3>
        <PageVersions slug={slug} pageId={pageId} />
      </div>

      {/* Comments */}
      <div className="mt-6 border-t border-border pt-6">
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comments
        </h3>
        <CommentsSection pageId={pageId} />
      </div>
    </div>
  );
}

// === Comments ===
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Comment } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { MessageSquare, Send } from 'lucide-react';

function useComments(pageId: string) {
  return useQuery<Comment[]>({
    queryKey: ['comments', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/comments`);
      return data;
    },
    enabled: !!pageId,
  });
}

function useCreateComment(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: string; parentId?: string }) => {
      const { data } = await api.post(`/pages/${pageId}/comments`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', pageId] });
    },
  });
}

function CommentsSection({ pageId }: { pageId: string }) {
  const { data: comments, isLoading } = useComments(pageId);
  const createComment = useCreateComment(pageId);
  const [newComment, setNewComment] = useState('');
  const user = useAuthStore((s) => s.user);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createComment.mutate({ content: newComment }, {
      onSuccess: () => setNewComment(''),
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

  return (
    <div className="space-y-4">
      {/* New comment */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={createComment.isPending || !newComment.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Comment list */}
      {comments && comments.length === 0 && (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
        </div>
      )}

      {comments?.map((comment) => (
        <div key={comment.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{comment.authorId === user?.id ? 'You' : comment.authorId}</span>
            <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-foreground/90">{comment.content}</p>
          {comment.children && comment.children.length > 0 && (
            <div className="mt-2 ml-4 space-y-2 border-l-2 border-border pl-3">
              {comment.children.map((reply) => (
                <div key={reply.id} className="text-sm">
                  <span className="font-medium">{reply.authorId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleString()}</span>
                  <p className="text-foreground/90">{reply.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
