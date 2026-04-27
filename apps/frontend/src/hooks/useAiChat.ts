'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Shape persisted on the server. The `sources` JSON is only present on
 * assistant messages; for user messages it is null/undefined.
 */
export interface AiSource {
  pageId: string;
  title: string;
  snippet?: string;
  spaceSlug?: string;
  spaceName?: string;
  slug?: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[] | null;
  createdAt: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: AiMessage[];
}

interface PaginatedConversations {
  data: AiConversationSummary[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Hook that owns the chat panel state: the list of conversations, the
 * currently open conversation, and streaming of new assistant replies over
 * SSE.
 *
 * Mirrors the pattern used by other SSE endpoints in the codebase — reads
 * `fetch()` as a stream and buffers SSE `data:` lines.
 */
export function useAiChat() {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get<PaginatedConversations>('/ai-chat/conversations', {
        params: { skip: 0, take: 20 },
      });
      setConversations(data.data);
    } catch (err) {
      console.warn('Failed to load conversations', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setCurrentId(id);
    setLoadingConvo(true);
    setError(null);
    try {
      const { data } = await api.get<AiConversation>(`/ai-chat/conversations/${id}`);
      setMessages(data.messages || []);
    } catch (err) {
      console.warn('Failed to load conversation', err);
      setError('errorGeneric');
    } finally {
      setLoadingConvo(false);
    }
  }, []);

  const createConversation = useCallback(async (title?: string): Promise<string> => {
    const { data } = await api.post<AiConversationSummary>('/ai-chat/conversations', {
      title,
    });
    setConversations((prev) => [data, ...prev]);
    setCurrentId(data.id);
    setMessages([]);
    return data.id;
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await api.delete(`/ai-chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentId === id) {
        setCurrentId(null);
        setMessages([]);
      }
    },
    [currentId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (streaming) return;
      setError(null);

      // Ensure we have a conversation — create one if needed.
      let conversationId = currentId;
      if (!conversationId) {
        conversationId = await createConversation();
      }

      // Optimistically add user message
      const optimistic: AiMessage = {
        id: `tmp-${Date.now()}`,
        conversationId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setStreaming(true);
      setStreamBuffer('');

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/v1/ai-chat/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message: text }),
          },
        );

        if (!res.ok || !res.body) {
          if (res.status === 503) {
            setError('errorNoProvider');
          } else {
            setError('errorGeneric');
          }
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assembled = '';

        // Loop: read chunks, parse SSE lines, accumulate delta.
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const ev of events) {
            for (const line of ev.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed?.delta === 'string') {
                  assembled += parsed.delta;
                  setStreamBuffer(assembled);
                }
              } catch {
                // Ignore
              }
            }
          }
        }

        // Re-fetch the conversation so we get the assistant message with
        // persisted `sources` metadata + real ids.
        try {
          const { data: fresh } = await api.get<AiConversation>(
            `/ai-chat/conversations/${conversationId}`,
          );
          setMessages(fresh.messages || []);
        } catch {
          // Fall back to keeping the buffered text as an assistant message.
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              conversationId: conversationId!,
              role: 'assistant',
              content: assembled,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
        void refreshConversations();
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Chat stream failed', err);
        setError('errorGeneric');
      } finally {
        setStreaming(false);
        setStreamBuffer('');
        abortRef.current = null;
      }
    },
    [streaming, currentId, createConversation, refreshConversations],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const startNewConversation = useCallback(() => {
    setCurrentId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    conversations,
    currentId,
    messages,
    streaming,
    streamBuffer,
    error,
    loadingList,
    loadingConvo,
    refreshConversations,
    openConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    abort,
    startNewConversation,
  };
}
