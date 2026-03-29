import { useState, useCallback, useRef } from 'react';

type AiOperation = 'expand' | 'summarize' | 'fix-grammar' | 'change-tone' | 'custom-prompt';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useAiTransform() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const transform = useCallback(
    async (
      pageId: string,
      selection: string,
      operation: AiOperation,
      context?: string,
      customPrompt?: string,
    ): Promise<string> => {
      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setResult('');
      setError(null);

      const token = localStorage.getItem('accessToken');

      try {
        const res = await fetch(`${API_BASE}/api/v1/ai/transform`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ pageId, selection, operation, context, ...(customPrompt ? { customPrompt } : {}) }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            try {
              const event = JSON.parse(json);
              if (event.text) {
                fullText += event.text;
                setResult(fullText);
              }
              if (event.error) {
                throw new Error(event.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.startsWith('{')) {
                throw e;
              }
            }
          }
        }

        setIsLoading(false);
        return fullText;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setIsLoading(false);
          return '';
        }
        const msg = err?.message || 'AI transform failed';
        setError(msg);
        setIsLoading(false);
        throw err;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { transform, isLoading, result, error, cancel };
}
